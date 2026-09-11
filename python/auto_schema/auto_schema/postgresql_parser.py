"""Narrow adapters for PostgreSQL names reported at an error position."""


def type_name_at_position(statement, position, *, standard_conforming_strings=True, backslash_quote=True):
    parsed = _parse_at_position(statement, position, standard_conforming_strings, backslash_quote)
    if parsed is None:
        return None
    tree, location = parsed
    from postgast import pg_query_pb2, walk

    names = {
        tuple(part.string.sval for part in node.names)
        for _, node in walk(tree)
        if isinstance(node, pg_query_pb2.TypeName)
        and node.location == location and not node.pct_type and node.names
    }
    return names.pop() if len(names) == 1 else None


def column_name_at_position(statement, position, *, indirect=False, standard_conforming_strings=True, backslash_quote=True):
    parsed = _parse_at_position(statement, position, standard_conforming_strings, backslash_quote)
    if parsed is None:
        return None
    tree, location = parsed
    from postgast import pg_query_pb2, walk

    names = set()
    for _, node in walk(tree):
        if indirect:
            # (table).column reports the position of table. Only a single field
            # of a named row is attributable to adding a column on that table.
            if not isinstance(node, pg_query_pb2.A_Indirection) or not node.arg.HasField("column_ref"):
                continue
            if node.arg.column_ref.location != location or len(node.indirection) != 1:
                continue
            fields = [*node.arg.column_ref.fields, *node.indirection]
        else:
            if not isinstance(node, pg_query_pb2.ColumnRef) or node.location != location:
                continue
            fields = node.fields
        if fields and all(part.HasField("string") for part in fields):
            names.add(tuple(part.string.sval for part in fields))
    return names.pop() if len(names) == 1 else None


def _parse_at_position(statement, position, standard_conforming_strings, backslash_quote):
    if not isinstance(statement, str):
        return None
    try:
        offset = int(position) - 1
    except (TypeError, ValueError):
        return None
    if not 0 <= offset < len(statement):
        return None

    # Only missing-name comparison needs the native parser. Ordinary comparison
    # and SQLite do not load it. PostgreSQL reports character positions, whereas
    # libpg_query AST locations are zero-based UTF-8 byte offsets.
    from postgast import PgQueryError

    location = len(statement[:offset].encode('utf-8'))
    try:
        tree = _parse(statement, standard_conforming_strings, backslash_quote)
    except PgQueryError:
        # A parser/server grammar mismatch must preserve the original DB error.
        return None
    return tree, location


def _parse(statement, standard_conforming_strings, backslash_quote):
    from postgast import parse

    if standard_conforming_strings and backslash_quote:
        return parse(statement)

    # postgast 0.1.0 bundles libpg_query 17 but its public parse() omits parser
    # options. Keep this pinned ABI adapter here so lexer settings match the
    # server without rewriting SQL. The result is freed on every path.
    import ctypes
    from postgast.errors import check_error
    from postgast.native import PgQueryProtobufParseResult, lib
    from postgast.pg_query_pb2 import ParseResult

    parser = lib.pg_query_parse_protobuf_opts
    parser.argtypes = [ctypes.c_char_p, ctypes.c_int]
    parser.restype = PgQueryProtobufParseResult
    options = (0 if standard_conforming_strings else 32) | (0 if backslash_quote else 16)
    result = parser(statement.encode('utf-8'), options)
    try:
        check_error(result)
        data = result.parse_tree
        return ParseResult.FromString(ctypes.string_at(data.data, data.len))
    finally:
        lib.pg_query_free_protobuf_parse_result(result)

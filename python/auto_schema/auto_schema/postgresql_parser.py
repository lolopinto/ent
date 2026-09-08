"""Narrow adapter for PostgreSQL type names reported at an error position."""


def type_name_at_position(statement, position, *, standard_conforming_strings=True, backslash_quote=True):
    if not isinstance(statement, str):
        return None
    try:
        offset = int(position) - 1
    except (TypeError, ValueError):
        return None
    if not 0 <= offset < len(statement):
        return None

    # Only missing-type comparison needs the native parser. Ordinary comparison
    # and SQLite do not load it. PostgreSQL reports character positions, whereas
    # libpg_query AST locations are zero-based UTF-8 byte offsets.
    from postgast import PgQueryError, pg_query_pb2, walk

    location = len(statement[:offset].encode('utf-8'))
    try:
        tree = _parse(statement, standard_conforming_strings, backslash_quote)
    except PgQueryError:
        # A parser/server grammar mismatch must preserve the original DB error.
        return None
    names = {
        tuple(part.string.sval for part in node.names)
        for _, node in walk(tree)
        if isinstance(node, pg_query_pb2.TypeName)
        and node.location == location and not node.pct_type and node.names
    }
    return names.pop() if len(names) == 1 else None


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

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import re
from typing import Optional


def get_sorted_enum_values(connection: sa.engine.Connection, enum_type: str):
    # we gotta go to the db and check the order
    db_sorted_enums = []
    # https://www.postgresql.org/docs/9.5/functions-enum.html
    query = "select unnest(enum_range(enum_first(null::%s)));" % (
        enum_type)
    for row in connection.execute(query):
        db_sorted_enums.append(dict(row)['unnest'])

    return db_sorted_enums


index_regex = re.compile('CREATE INDEX (.+) USING (gin|btree|gist)(.+)')


def _dialect_name(conn: sa.engine.Connection) -> str:
    return conn.dialect.name


# sqlalchemy doesn't reflect postgres indexes that have expressions in them so have to manually
# fetch these indices from pg_indices to find them
# warning: "Skipped unsupported reflection of expression-based index accounts_full_text_idx"

# this only returns those that match a using...
# TODO check what happens when this is not all-caps
def get_raw_db_indexes(connection: sa.engine.Connection, table: Optional[sa.Table]):
    if table is None or _dialect_name(connection) != 'postgresql':
        return {'missing': {}, 'all': {}}

    missing = {}
    all = {}
    # we cache the db hit but the table seems to change across the same call and so we're
    # just paying the CPU price. can probably be fixed in some way...
    names = set([index.name for index in table.indexes] +
                [constraint.name for constraint in table.constraints])
    res = _get_db_indexes_for_table(connection, table.name)

    for row in res.fetchall():
        (
            name,
            details
        ) = row
        m = index_regex.match(details)
        if m is None:
            continue

        r = m.groups()

        all[name] = {
            'postgresql_using': r[1],
            'postgresql_using_internals': r[2],
            # TODO don't have columns|column to pass to FullTextIndex
        }

        # missing!
        if name not in names:
            missing[name] = {
                'postgresql_using': r[1],
                'postgresql_using_internals': r[2],
                # TODO don't have columns|column to pass to FullTextIndex
            }

    return {'missing': missing, 'all': all}


# use a cache so we only hit the db once for each table
# @functools.lru_cache()
def _get_db_indexes_for_table(connection: sa.engine.Connection, tname: str):
    res = connection.execute(
        "SELECT indexname, indexdef from pg_indexes where tablename = '%s'" % tname)
    return res


def default_index(table: sa.Table, col_name: str):
    col = table.columns[col_name]
    if isinstance(col.type, postgresql.JSONB) or isinstance(col.type, postgresql.JSON) or isinstance(col.type, postgresql.ARRAY):
        return 'gin'
    return 'btree'

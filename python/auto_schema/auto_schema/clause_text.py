from sqlalchemy.sql.schema import DefaultClause
from sqlalchemy.sql.elements import TextClause
import re
import datetime

clause_regex = re.compile("(.+)'::(.+)")
date_regex = re.compile(
    '[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}')

valid_suffixes = {
    'text': True,
    'double precision': True,
    'bigint': True,
    'timestamp without time zone': True,
    'timestamp with time zone': True,
    'time without time zone': True,
    'time with time zone': True,
    'date': True,
    'jsonb': True,
    'json': True,
}


def get_clause_text(server_default):
    if server_default is None:
        return server_default

    def handle_date(arg):
        if date_regex.match(arg) is None:
            return arg

# TODO timestamp not handled
        # TODO test with more complicated values...

        # not working with timezone...
        print(arg)
        return datetime.datetime.strptime(arg,
                                          '%Y-%m-%d %H:%M:%S%z').isoformat()
# # TODO...
#     return arg

    def normalize(arg):
        # return the underlying string instead of quoted
        arg = str(arg).strip("'")

        # strip the extra text padding added so we can compare effectively
        # TODO need to do this better
        m = clause_regex.match(arg)
        if m is None:
            return handle_date(arg)

        if valid_suffixes.get(m.group(2)):
            return handle_date(m.group(1))

        return handle_date(arg)

    if isinstance(server_default, TextClause):
        return normalize(server_default.text)

    if isinstance(server_default, DefaultClause):
        return normalize(server_default.arg)

    return normalize(server_default)

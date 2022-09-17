from sqlalchemy.sql.schema import DefaultClause
from sqlalchemy.sql.elements import TextClause
import re
import datetime

clause_regex = re.compile("(.+)'::(.+)")
date_regex = re.compile(
    '([0-9]{4})-([0-9]{2})-([0-9]{2}) ([0-9]{2}):([0-9]{2}):([0-9]{2})(.+)?')

# this only applies to timestamp with timezone...
iso_regex = re.compile(
    '[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(.+)')

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
    # mostly used for lists
    'integer': True,
}


def get_clause_text(server_default):
    if server_default is None:
        return server_default

    def handle_date(arg, type=None):
        utc = datetime.timezone(datetime.timedelta())

        m = date_regex.match(arg)
        if m is None:
            m2 = iso_regex.match(arg)

            if m2 is not None:
                date = datetime.datetime.strptime(
                    arg, '%Y-%m-%dT%H:%M:%S%z')
                return date.astimezone(utc).isoformat()

            return arg

        tz = None
        if m.group(7) is not None:
            tz = datetime.timezone(
                datetime.timedelta(hours=int(m.group(7))))

        date = datetime.datetime(int(m.group(1)), int(m.group(2)), int(
            m.group(3)), int(m.group(4)), int(m.group(5)), int(m.group(6)), 0, tz)

        if type == 'timestamp with time zone':
            return date.astimezone(utc).isoformat()

        return date.isoformat()

    def normalize(arg):
        # return the underlying string instead of quoted
        arg = str(arg).strip("'")

        # strip the extra text padding added so we can compare effectively
        # TODO need to do this better
        m = clause_regex.match(arg)
        if m is None:
            return handle_date(arg)

        type = m.group(2)
        if valid_suffixes.get(type):
            return handle_date(m.group(1), type)
        # handle list types
        elif type.endswith("[]") and valid_suffixes.get(type.strip("[]")):
            return handle_date(m.group(1), type)
        return handle_date(arg)

    if isinstance(server_default, TextClause):
        return normalize(server_default.text)

    if isinstance(server_default, DefaultClause):
        return normalize(server_default.arg)

    return normalize(server_default)

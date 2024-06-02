from sqlalchemy.sql.schema import DefaultClause
from sqlalchemy.sql.elements import TextClause
import re
import datetime
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

clause_regex = re.compile("(.+)'::(.+)")
date_regex = re.compile(
    '([0-9]{4})-([0-9]{2})-([0-9]{2})[T| ]([0-9]{2}):([0-9]{2}):([0-9]{2})(\.[0-9]{3})?(.+)?')


valid_suffixes = {
    'text',
    'double precision',
    'bigint',
    'timestamp without time zone',
    'timestamp with time zone',
    'time without time zone',
    'time with time zone',
    'date',
    'jsonb',
    'json',
    # mostly used for lists
    'integer',
    'character varying',
    'uuid',
}

def handle_date(arg, col_type):
    utc = datetime.timezone(datetime.timedelta())

    m = date_regex.match(arg)
    if m is None:
        return arg

    tz = None
    tz_data = m.group(8)
    mins = 0
    if tz_data is not None:
        if tz_data == 'Z':
            tz_data = 0
        else:
            parts = tz_data.split(":")
            if len(parts) == 2:
                tz_data = parts[0]
                mins = float(parts[1])
    else:
        tz_data = 0

    tz = datetime.timezone(
        datetime.timedelta(hours=float(tz_data), minutes=mins))

    ms = m.group(7)
    if ms is None:
        ms = 0
    date = datetime.datetime(int(m.group(1)), int(m.group(2)), int(
        m.group(3)), int(m.group(4)), int(m.group(5)), int(m.group(6)), int(float(ms) * 1000000), tz)

    if isinstance(col_type, sa.TIMESTAMP) and col_type.timezone:
        return date.astimezone(utc).isoformat()

    return date.isoformat()


def normalize_clause_text(arg, col_type):
    # return the underlying string instead of quoted
    arg = str(arg).strip("'")

    # strip the extra text padding added so we can compare effectively
    m = clause_regex.match(arg)
    if m is None:
        return handle_date(arg, col_type)

    type = m.group(2)
    default = m.group(1)
    if type in valid_suffixes:
        return handle_date(default, col_type)
    # handle list types
    elif type.endswith("[]") and type.strip("[]") in valid_suffixes:
        return handle_date(default, col_type)

    if isinstance(col_type, postgresql.ENUM) and col_type.name == type:
        return default

    return handle_date(arg, col_type)

def get_clause_text(server_default, col_type):
    if server_default is None:
        return server_default

    match server_default:
        case TextClause():
            return normalize_clause_text(server_default.text, col_type)

        case DefaultClause():
            return normalize_clause_text(server_default.arg, col_type)

        case _:
            return normalize_clause_text(server_default, col_type)

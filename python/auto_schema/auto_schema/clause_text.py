from sqlalchemy.sql.schema import DefaultClause
from sqlalchemy.sql.elements import TextClause


def get_clause_text(server_default):
    if server_default is None:
        return server_default

    def normalize(arg):
        # return the underlying string instead of quoted
        arg = str(arg).strip("'")

        # strip the extra text padding added so we can compare effectively
        if arg.endswith("'::text"):
            return arg.strip("'::text")
        return arg

    if isinstance(server_default, TextClause):
        return normalize(server_default.text)

    if isinstance(server_default, DefaultClause):
        return normalize(server_default.arg)

    return normalize(server_default)

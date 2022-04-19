from sqlalchemy.sql.schema import Index
from sqlalchemy import exc


# simplified version
# postgresql_using
# posgresqql_using_internals
class FullTextIndex(Index):

    def __init__(self, name: str, **kw) -> None:
        # no columns
        super().__init__(name, kw.get('column', "id"), **kw)

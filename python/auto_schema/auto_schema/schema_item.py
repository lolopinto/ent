from sqlalchemy.sql.schema import Index
from sqlalchemy import exc


# simplified version
# postgresql_using
# posgresqql_using_internals
class FullTextIndex(Index):

    def __init__(self, name: str, **kw) -> None:
        # TODO make it required
        cols = ['id']
        if 'columns' in kw:
            cols = kw.get('columns')
        elif 'column' in kw:
            cols = [kw.get('column')]
        super().__init__(name, *cols, **kw)

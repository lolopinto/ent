from sqlalchemy.sql.schema import Index
from sqlalchemy import exc


# simplified version
# postgresql_using
# posgresqql_using_internals
# need our own Index class because
class FullTextIndex(Index):

    def __init__(self, name: str, **kw) -> None:
        # TODO make column|columns required
        # not currently required because of _get_raw_db_indexes
        # we don't use it anyways so fine. just passed to super() because we need to pass something
        cols = ['id']
        info = kw.get('info', {})
        if 'columns' in info:
            cols = info.get('columns')
        elif 'column' in info:
            cols = [info.get('column')]
        super().__init__(name, *cols, **kw)

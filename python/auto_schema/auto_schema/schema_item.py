from sqlalchemy.sql.schema import Index
from sqlalchemy.types import UserDefinedType


class CustomSQLAlchemyType(UserDefinedType):
    cache_ok = True

    def __init__(self, type_name: str) -> None:
        self.type_name = type_name

    def get_col_spec(self, **kw) -> str:
        return self.type_name

    def __repr__(self) -> str:
        return f"CustomSQLAlchemyType({self.type_name!r})"


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

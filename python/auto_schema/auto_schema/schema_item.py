from sqlalchemy.sql.schema import Index
from sqlalchemy import exc


# simplified version
# postgresql_using
# posgresqql_using_internals
class FullTextIndex(Index):

    def __init__(self, name: str, **kw) -> None:
        # no columns
        super().__init__(name, kw.get('column', "id"), **kw)
        # self.name = name
        # self.unique = kw.pop("unique", False)
        # self.table = None
        # if "info" in kw:
        #     self.info = kw.pop("info")
        # if "table" in kw:
        #     self.table = kw.pop("table")

#        super().__init__()

    # def _set_parent(self, table, **kw):
    #     #        ColumnCollectionMixin._set_parent(self, table)

    #     if self.table is not None and table is not self.table:
    #         raise exc.ArgumentError(
    #             "Index '%s' is against table '%s', and "
    #             "cannot be associated with table '%s'."
    #             % (self.name, self.table.description, table.description)
    #         )
    #     self.table = table
    #     table.indexes.add(self)

import alembic.operations.ops as alembicops
from alembic.operations import Operations, MigrateOperation
import abc

from sqlalchemy.sql.sqltypes import String
from .change_type import ChangeType


class MigrateOpInterface(MigrateOperation, metaclass=abc.ABCMeta):
    @abc.abstractmethod
    def get_revision_message(self) -> String:
        pass

    @abc.abstractmethod
    def get_change_type(self) -> ChangeType:
        pass

    @abc.abstractmethod
    def get_table_name(self) -> String:
        pass


@Operations.register_operation("add_edges")
class AddEdgesOp(MigrateOpInterface):

    """Add one or more new edges."""

    def __init__(self, edges, schema=None):
        self.edges = edges
        self.schema = schema

    @classmethod
    def add_edges(cls, operations, edges, **kw):
        """Issue an "add edges" operation"""

        op = AddEdgesOp(edges, **kw)
        return operations.invoke(op)

    def reverse(self):
        return RemoveEdgesOp(self.edges, schema=self.schema)

    def get_revision_message(self) -> String:
        return _get_revision_message_for_edges(self.edges, "add edge %s", "add edges %s")

    def get_change_type(self) -> ChangeType:
        return ChangeType.ADD_EDGES

    def get_table_name(self) -> String:
        return "assoc_edge_config"


@Operations.register_operation("remove_edges")
class RemoveEdgesOp(MigrateOpInterface):

    """Removes one or more existing edges."""

    def __init__(self, edges, schema=None):
        self.edges = edges
        self.schema = schema

    @classmethod
    def remove_edges(cls, operations, edges, **kw):
        """Issue a "remove edges" operation"""

        op = RemoveEdgesOp(edges, **kw)
        return operations.invoke(op)

    def reverse(self):
        return AddEdgesOp(self.edges, schema=self.schema)

    def get_revision_message(self) -> String:
        return _get_revision_message_for_edges(self.edges, "remove edge %s", "remove edges %s")

    def get_change_type(self) -> ChangeType:
        return ChangeType.REMOVE_EDGES

    def get_table_name(self) -> String:
        return "assoc_edge_config"


def _get_revision_message_for_edges(edges, single_edge_msg, multi_edge_msg):
    if len(edges) == 1:
        return single_edge_msg % (edges[0]['edge_name'])

    edge_names = [edge['edge_name'] for edge in edges]
    return multi_edge_msg % (", ".join(sorted(edge_names)))


def _get_revision_message_for_rows(rows, table_name, single_row_msg, multi_row_msg):
    if len(rows) == 1:
        return single_row_msg % (table_name)

    return multi_row_msg % (table_name)


@Operations.register_operation("modify_edge")
class ModifyEdgeOp(MigrateOpInterface):

    """Modify an existing edge"""

    def __init__(self, edge_type, new_edge, old_edge, schema=None):
        self.edge_type = edge_type
        self.new_edge = new_edge
        self.old_edge = old_edge
        self.schema = schema

    @classmethod
    def modify_edge(cls, operations, edge_type, new_edge, old_edge=None, **kw):
        """Issue a "modify edge" operation"""

        op = ModifyEdgeOp(edge_type, new_edge, old_edge, **kw)
        return operations.invoke(op)

    def reverse(self):
        return ModifyEdgeOp(self.edge_type, self.old_edge, self.new_edge, schema=self.schema)

    def get_revision_message(self) -> String:
        # assume name is not changing. if this is changing, this needs to be smarter
        return "modify edge %s" % (self.old_edge['edge_name'])

    def get_change_type(self) -> ChangeType:
        return ChangeType.MODIFY_EDGE

    def get_table_name(self) -> String:
        return "assoc_edge_config"


@Operations.register_operation("add_rows")
class AddRowsOp(MigrateOpInterface):

    """Add one or more new rows to table."""

    def __init__(self, table_name, pkeys, rows, schema=None):
        self.table_name = table_name
        self.rows = rows
        self.pkeys = pkeys
        self.schema = schema

    @classmethod
    def add_rows(cls, operations, table_name, pkeys, rows, **kw):
        """Issue an "add rows" operation"""

        op = AddRowsOp(table_name, pkeys, rows, **kw)
        return operations.invoke(op)

    def reverse(self):
        return RemoveRowsOp(self.table_name, self.pkeys, self.rows, schema=self.schema)

    def get_revision_message(self) -> String:
        return _get_revision_message_for_rows(self.rows, self.table_name, "add row to %s", "add rows to %s")

    def get_change_type(self) -> ChangeType:
        return ChangeType.ADD_ROWS

    def get_table_name(self) -> String:
        return self.table_name


@Operations.register_operation("remove_rows")
class RemoveRowsOp(MigrateOpInterface):

    """Removes one or more existing rows."""

    def __init__(self, table_name, pkeys, rows, schema=None):
        self.table_name = table_name
        self.rows = rows
        self.pkeys = pkeys
        self.schema = schema

    @classmethod
    def remove_rows(cls, operations, table_name, pkeys, rows, **kw):
        """Issue a "remove rows" operation"""

        op = RemoveRowsOp(table_name, pkeys, rows, **kw)
        return operations.invoke(op)

    def reverse(self):
        return AddRowsOp(self.table_name, self.pkeys, self.rows, schema=self.schema)

    def get_revision_message(self) -> String:
        return _get_revision_message_for_rows(self.rows, self.table_name, "remove row from %s", "remove rows from %s")

    def get_change_type(self) -> ChangeType:
        return ChangeType.REMOVE_ROWS

    def get_table_name(self) -> String:
        return self.table_name


@Operations.register_operation("modify_rows")
class ModifyRowsOp(MigrateOpInterface):

    """Modify an existing row"""

    def __init__(self, table_name, pkeys, rows, old_rows, schema=None):
        self.table_name = table_name
        self.rows = rows
        self.pkeys = pkeys
        self.old_rows = old_rows
        self.schema = schema

    @classmethod
    def modify_rows(cls, operations, table_name, pkeys, rows, old_rows, schema=None):
        """Issue a "modify rows" operation"""

        op = ModifyRowsOp(table_name, pkeys, rows, old_rows, schema)
        return operations.invoke(op)

    def reverse(self):
        return ModifyRowsOp(self.table_name, self.pkeys, self.old_rows, self.rows, schema=self.schema)

    def get_revision_message(self) -> String:
        return "modify rows in %s" % self.table_name

    def get_change_type(self) -> ChangeType:
        return ChangeType.MODIFY_ROWS

    def get_table_name(self) -> String:
        return self.table_name


@Operations.register_operation("alter_enum")
class AlterEnumOp(MigrateOpInterface):

    """Alters enum."""

    def __init__(self, enum_name, value, schema=None, before=None):
        self.enum_name = enum_name
        self.value = value
        self.before = before

    @classmethod
    def alter_enum(cls, operations, enum_name, value, **kw):
        """Issues an "alter enum" operation"""

        op = AlterEnumOp(enum_name, value, schema=kw.get(
            'schema', None), before=kw.get('before', None))
        return operations.invoke(op)

    def reverse(self):
        return NoDowngradeOp()

    def get_revision_message(self) -> String:
        return 'alter enum %s, add value %s' % (self.enum_name, self.value)

    def get_change_type(self) -> ChangeType:
        return ChangeType.ALTER_ENUM

    def get_table_name(self) -> String:
        return "enum_schema"


@Operations.register_operation("no_downgrade")
class NoDowngradeOp(MigrateOperation):
    @classmethod
    def no_downgrade(cls, operations, *kw):

        op = NoDowngradeOp(*kw)
        return operations.invoke(op)
    pass


@Operations.register_operation("add_enum_type")
class AddEnumOp(MigrateOpInterface):

    """Adds enum type."""

    def __init__(self, enum_name, values, schema=None):
        self.enum_name = enum_name
        self.values = values

    @classmethod
    def add_enum_type(cls, operations, enum_name, values, **kw):
        """Issues an "add emum" operation"""

        op = AddEnumOp(enum_name, values, schema=kw.get(
            'schema', None))
        return operations.invoke(op)

    def reverse(self):
        return DropEnumOp(self.enum_name, self.values)

    def get_revision_message(self) -> String:
        return 'add enum %s' % (self.enum_name)

    def get_change_type(self) -> ChangeType:
        return ChangeType.ADD_ENUM

    def get_table_name(self) -> String:
        return "enum_schema"


@Operations.register_operation("drop_enum_type")
class DropEnumOp(MigrateOpInterface):

    """Drop enum type."""

    def __init__(self, enum_name, values, schema=None):
        self.enum_name = enum_name
        self.values = values

    @classmethod
    def drop_enum_type(cls, operations, enum_name, values, **kw):
        """Issues a "drop emum" operation"""

        op = DropEnumOp(enum_name, values, schema=kw.get(
            'schema', None))
        return operations.invoke(op)

    def reverse(self):
        return AddEnumOp(self.enum_name, self.values)

    def get_revision_message(self) -> String:
        return 'drop enum %s' % (self.enum_name)

    def get_change_type(self) -> ChangeType:
        return ChangeType.DROP_ENUM

    def get_table_name(self) -> String:
        return "enum_schema"

# overriding this so that we can implement dispatch and render
# alembic for some reason doesn't have it...


class OurCreateCheckConstraintOp(MigrateOpInterface, alembicops.CreateCheckConstraintOp):

    def get_revision_message(self) -> String:
        return 'add constraint %s to %s' % (self.constraint_name, self.table_name)

    def get_change_type(self) -> ChangeType:
        return ChangeType.CREATE_CHECK_CONSTRAINT

    def get_table_name(self) -> String:
        return self.table_name

# need to override this so that when we reverse, we render ours instead of theirs


class OurDropConstraintOp(MigrateOpInterface, alembicops.DropConstraintOp):

    def reverse(self):
        if self._orig_constraint is None:
            raise ValueError(
                "operation is not reversible; "
                "original constraint is not present"
            )
        return OurCreateCheckConstraintOp.from_constraint(self._orig_constraint)

    def get_revision_message(self) -> String:
        return 'drop constraint %s from %s' % (self.constraint_name, self.table_name)

    def get_change_type(self) -> ChangeType:
        return ChangeType.DROP_CHECK_CONSTRAINT

    def get_table_name(self) -> String:
        return self.table_name

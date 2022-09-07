from __future__ import annotations
from sqlalchemy.sql.sqltypes import String
from .clause_text import get_clause_text
from .change_type import ChangeType
from .change import Change
from .ops import MigrateOpInterface, DropFullTextIndexOp, CreateFullTextIndexOp

import alembic.operations.ops as alembicops

from typing import List, Sequence


class Diff(object):

    def __init__(self: Diff, diff: Sequence[alembicops.MigrateOperation], group_by_table=True):
        self._diff = diff
        self._changes = {}
        self._changes_list = []
        self._group_by_table = group_by_table

        self._exec_ops(self._diff)

    def list_changes(self: Diff) -> List[Change]:
        return self._changes_list

    def changes(self: Diff):
        return self._changes

    def _exec_ops(self: Diff, ops: Sequence[alembicops.MigrateOperation]):
        class_name_map = {
            'CreateTableOp': self._create_table,
            'DropTableOp': self._drop_table,
            'ModifyTableOps': self._modify_table,
            'AddColumnOp': self._add_column,
            'DropColumnOp': self._drop_column,
            'CreateIndexOp': self._create_index,
            'DropIndexOp': self._drop_index,
            'CreateFullTextIndexOp': self._create_full_text_index,
            'DropFullTextIndexOp': self._drop_full_text_index,
            'CreateForeignKeyOp': self._create_foreign_key,
            'AlterColumnOp': self._alter_column,
            'CreateUniqueConstraintOp': self._create_unique_constraint,
            # this is still sadly used
            'DropConstraintOp': self._drop_constraint,
            'CreateCheckConstraintOp': self._create_check_constraint,
        }

        for op in ops:
            if isinstance(op, MigrateOpInterface):
                self._custom_migrate_op(op)
            else:
                class_name_map[type(op).__name__](op)

    def _custom_migrate_op(self: Diff, op: MigrateOpInterface):
        self._append_change(op.get_table_name(), op.get_change())

    def _create_table(self: Diff, op: alembicops.CreateTableOp):
        self._append_change(op.table_name,                 {
            "change": ChangeType.ADD_TABLE,
            "desc": 'add %s table' % op.table_name,
        })

    def _drop_table(self: Diff, op: alembicops.DropTableOp):
        self._append_change(op.table_name,                 {
            "change": ChangeType.DROP_TABLE,
            "desc": 'drop %s table' % op.table_name,
        })

    def _modify_table(self: Diff, op: alembicops.ModifyTableOps):
        self._exec_ops(op.ops)

    def _add_column(self: Diff, op: alembicops.AddColumnOp):
        self._append_change(op.table_name, {
            "change": ChangeType.ADD_COLUMN,
            "desc": "add column %s to table %s" % (op.column.name, op.table_name),
            "col": op.column.name,
        })

    def _drop_column(self: Diff, op: alembicops.DropColumnOp):
        self._append_change(op.table_name, {
            "change": ChangeType.DROP_COLUMN,
            "desc": "drop column %s from table %s" % (op.column_name, op.table_name),
            "col": op.column_name,
        })

    def _create_index(self: Diff, op: alembicops.CreateIndexOp):
        self._append_change(op.table_name, {
            "change": ChangeType.CREATE_INDEX,
            "index": op.index_name,
            "desc": 'add index %s to %s' % (op.index_name, op.table_name),
        })

    def _drop_index(self: Diff, op: alembicops.DropIndexOp):
        self._append_change(op.table_name, {
            "change": ChangeType.DROP_INDEX,
            "index": op.index_name,
            "desc": 'drop index %s from %s' % (op.index_name, op.table_name),
        })

    def _create_full_text_index(self: Diff, op: CreateFullTextIndexOp):
        self._append_change(op.table_name, {
            "change": ChangeType.CREATE_FULL_TEXT_INDEX,
            "desc": 'add full text index %s to %s' % (op.index_name, op.table_name),
        })

    def _drop_full_text_index(self: Diff, op: DropFullTextIndexOp):
        self._append_change(op.table_name, {
            "change": ChangeType.DROP_FULL_TEXT_INDEX,
            "desc": 'drop full text index %s from %s' % (op.index_name, op.table_name),
        })

    def _create_foreign_key(self: Diff, op: alembicops.CreateForeignKeyOp):
        self._append_change(op.source_table, {
            "change": ChangeType.CREATE_FOREIGN_KEY,
            "desc": 'create fk constraint %s on %s' % (op.constraint_name, op.source_table),
        })

    def _create_unique_constraint(self: Diff, op: alembicops.CreateUniqueConstraintOp):
        self._append_change(op.table_name, {
            "change": ChangeType.CREATE_UNIQUE_CONSTRAINT,
            "desc": 'add unique constraint %s' % op.constraint_name,
        })

    def _drop_constraint(self: Diff, op: alembicops.DropConstraintOp):
        self._append_change(op.table_name, {
            "change": ChangeType.DROP_CHECK_CONSTRAINT,
            "desc": 'drop constraint %s from %s' % (op.constraint_name, op.table_name)
        })

    def _create_check_constraint(self: Diff, op: alembicops.CreateCheckConstraintOp):
        self._append_change(op.table_name, {
            "change": ChangeType.CREATE_CHECK_CONSTRAINT,
            "desc": 'add constraint %s to %s' % (op.constraint_name, op.table_name)
        })

    def _alter_column(self: Diff, op: alembicops.AlterColumnOp):
        def get_desc(op: alembicops.AlterColumnOp):
            if op.modify_type is not None:
                return 'modify column %s type from %s to %s' % (op.column_name, op.existing_type, op.modify_type)
            elif op.modify_nullable is not None:
                return 'modify nullable value of column %s from %s to %s' % (op.column_name, op.existing_nullable, op.modify_nullable)
            elif op.modify_server_default is not None:
                return 'modify server_default value of column %s from %s to %s' % (
                    op.column_name,
                    get_clause_text(op.existing_server_default),
                    get_clause_text(op.modify_server_default))
            elif op.modify_comment:
                return "modify comment of column %s"
            elif op.modify_name:
                return "modify name of column %s"
            elif op.modify_server_default is None and op.existing_server_default is not None:
                return 'modify server_default value of column %s from %s to None' % (
                    op.column_name,
                    get_clause_text(op.existing_server_default)
                )
            else:
                raise ValueError("unsupported alter_column op")

        self._append_change(op.table_name, {
            "change": ChangeType.ALTER_COLUMN,
            "desc": get_desc(op),
        })

    def _append_change(self: Diff, table_name: String, change: Change):
        if not self._group_by_table:
            self._changes_list.append(change)
            return

        changes = []
        if table_name in self._changes:
            changes = self._changes[table_name]
        changes.append(change)
        self._changes[table_name] = changes

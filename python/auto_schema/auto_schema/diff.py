from __future__ import annotations
from sqlalchemy.sql.sqltypes import String
from .clause_text import get_clause_text
from .change_type import ChangeType
from .change import Change
from .ops import MigrateOpInterface, DropFullTextIndexOp, CreateFullTextIndexOp

import alembic.operations.ops as alembicops

from typing import Sequence, defaultdict


class Diff(object):

    def __init__(self: Diff, diff: Sequence[alembicops.MigrateOperation], group_by_table=True):
        self._diff = diff
        self._changes = defaultdict(list)
        self._changes_list = []
        self._group_by_table = group_by_table

        self._exec_ops(self._diff)

    def list_changes(self: Diff) -> list[Change]:
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
            "desc": f"add {op.table_name} table",
        })

    def _drop_table(self: Diff, op: alembicops.DropTableOp):
        self._append_change(op.table_name,                 {
            "change": ChangeType.DROP_TABLE,
            "desc": f"drop {op.table_name} table",
        })

    def _modify_table(self: Diff, op: alembicops.ModifyTableOps):
        self._exec_ops(op.ops)

    def _add_column(self: Diff, op: alembicops.AddColumnOp):
        self._append_change(op.table_name, {
            "change": ChangeType.ADD_COLUMN,
            "desc": f"add column {op.column.name} to table {op.table_name}",
            "col": op.column.name,
        })

    def _drop_column(self: Diff, op: alembicops.DropColumnOp):
        self._append_change(op.table_name, {
            "change": ChangeType.DROP_COLUMN,
            "desc": f"drop column {op.column_name} from table {op.table_name}",
            "col": op.column_name,
        })

    def _create_index(self: Diff, op: alembicops.CreateIndexOp):
        self._append_change(op.table_name, {
            "change": ChangeType.CREATE_INDEX,
            "index": op.index_name,
            "desc": f"add index {op.index_name} to {op.table_name}",
        })

    def _drop_index(self: Diff, op: alembicops.DropIndexOp):
        self._append_change(op.table_name, {
            "change": ChangeType.DROP_INDEX,
            "index": op.index_name,
            "desc": f"drop index {op.index_name} from {op.table_name}",
        })

    def _create_full_text_index(self: Diff, op: CreateFullTextIndexOp):
        self._append_change(op.table_name, {
            "change": ChangeType.CREATE_FULL_TEXT_INDEX,
            "desc": f"add full text index {op.index_name} to {op.table_name}",
        })

    def _drop_full_text_index(self: Diff, op: DropFullTextIndexOp):
        self._append_change(op.table_name, {
            "change": ChangeType.DROP_FULL_TEXT_INDEX,
            "desc": f"drop full text index {op.index_name} from {op.table_name}",
        })

    def _create_foreign_key(self: Diff, op: alembicops.CreateForeignKeyOp):
        self._append_change(op.source_table, {
            "change": ChangeType.CREATE_FOREIGN_KEY,
            "desc": f"create fk constraint {op.constraint_name} on {op.source_table}",
        })

    def _create_unique_constraint(self: Diff, op: alembicops.CreateUniqueConstraintOp):
        self._append_change(op.table_name, {
            "change": ChangeType.CREATE_UNIQUE_CONSTRAINT,
            "desc": f"add unique constraint {op.constraint_name}",
        })

    def _drop_constraint(self: Diff, op: alembicops.DropConstraintOp):
        self._append_change(op.table_name, {
            "change": ChangeType.DROP_CHECK_CONSTRAINT,
            "desc": f"drop constraint {op.constraint_name} from {op.table_name}",
        })

    def _create_check_constraint(self: Diff, op: alembicops.CreateCheckConstraintOp):
        self._append_change(op.table_name, {
            "change": ChangeType.CREATE_CHECK_CONSTRAINT,
            "desc": f"add constraint {op.constraint_name} to {op.table_name}",
        })

    def _alter_column(self: Diff, op: alembicops.AlterColumnOp):
        def get_desc(op: alembicops.AlterColumnOp):
            if op.modify_type is not None:
                return f"modify column {op.column_name} type from {op.existing_type} to {op.modify_type}"
            elif op.modify_nullable is not None:
                return f"modify nullable value of column {op.column_name} from {op.existing_nullable} to {op.modify_nullable}"
            elif op.modify_server_default is not None:
                # these 3 here could flag it to be rendered differently
                existing_clause_text = get_clause_text(
                    op.existing_server_default,
                    op.existing_type,
                )
                modified_clause_text = get_clause_text(op.modify_server_default, op.modify_type)
                return f"modify server_default value of column {op.column_name} from {existing_clause_text} to {modified_clause_text}"
            elif op.modify_comment:
                return f"modify comment of column {op.modify_comment}"
            elif op.modify_name:
                return f"modify name of column {op.modify_name}"
            elif op.modify_server_default is None and op.existing_server_default is not None:
                existing_clause_text = get_clause_text(
                    op.existing_server_default,
                    op.existing_type,
                )
                return f"modify server_default value of column {op.column_name} from {existing_clause_text} to None"
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

        self._changes[table_name].append(change)

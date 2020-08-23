import pprint

import sqlalchemy as sa

from alembic.migration import MigrationContext
from alembic.autogenerate import produce_migrations
from alembic.autogenerate import render_python_code

from sqlalchemy.sql.schema import DefaultClause
from sqlalchemy.sql.elements import TextClause

from . import command
from . import config
from . import ops
from . import renderers
from . import compare
from . import ops_impl


class Runner(object):
    def __init__(self, metadata, connection, schema_path):
        self.metadata = metadata
        self.schema_path = schema_path
        self.connection = connection

        config.metadata = self.metadata
        config.connection = connection

        self.mc = MigrationContext.configure(
            connection=self.connection,
            # note that any change here also needs a comparable change in env.py
            opts={
                "compare_type": Runner.compare_type,
                "include_object": Runner.include_object,
                "compare_server_default": Runner.compare_server_default,
                "transaction_per_migration": True,
            },
        )
        self.cmd = command.Command(self.connection, self.schema_path)

    @classmethod
    def from_command_line(cls, metadata, args):
        engine = sa.create_engine(args.engine)
        connection = engine.connect()
        metadata.bind = connection
        return Runner(metadata, connection, args.schema)

    @classmethod
    def fix_edges(cls, metadata, args):
        engine = sa.create_engine(args.engine)
        connection = engine.connect()

        edges_map = metadata.info.setdefault("edges", {})
        edge_op.add_edges_from(connection, list(edges_map['public'].values()))

    @classmethod
    def exclude_tables(cls):
        # prevent default POSTGIS tables from affecting this
        return "geography_columns,geometry_columns,raster_columns,raster_overviews,spatial_ref_sys"

    @classmethod
    def compare_type(cls, context, inspected_column, metadata_column, inspected_type, metadata_type):
        # return False if the metadata_type is the same as the inspected_type
        # or None to allow the default implementation to compare these
        # types. a return value of True means the two types do not
        # match and should result in a type change operation.

        #print(context, inspected_column, metadata_column, inspected_type, metadata_type, type(inspected_type), type(metadata_type))

        # going from VARCHAR to Text is accepted && makes sense and we should accept that change.
        if isinstance(inspected_type, sa.VARCHAR) and isinstance(metadata_type, sa.Text):
            return True

        # going from Date() to TIMESTAMP is accepted && makes sense and we should accept that change.
        # TODO: we should allow going from all less-precise to more-precise since we're not losing any information
        if isinstance(inspected_type, sa.Date) and isinstance(metadata_type, sa.TIMESTAMP):
            return True

        return False

    @classmethod
    def include_object(cls, object, name, type, reflected, compare_to):
        exclude_tables = Runner.exclude_tables().split(',')

        if type == "table" and name in exclude_tables:
            return False
        else:
            return True

    @classmethod
    def convert_postgres_boolean(cls, metadata_default):
        boolean_map = {
            'true': 'true',
            't': 'true',
            'y': 'true',
            'yes': 'true',
            'TRUE': 'true',
            '1': 'true',
            'false': 'false',
            'f': 'false',
            'n': 'false',
            'no': 'false',
            'FALSE': 'false',
            '0': 'false',
        }
        # postgres is very liberal about what it allows for boolean values so support that here
        if metadata_default in boolean_map:
            return boolean_map[metadata_default]
        return metadata_default

    @classmethod
    def compare_server_default(cls, context, inspected_column, metadata_column, inspected_default, metadata_default, rendered_metadata_default):
        # let's just do simple comparison for now.
        # Things may get more complicated in the future but this works for now

        new_inspected_default = cls.get_clause_text(inspected_default)
        new_metadata_default = cls.get_clause_text(metadata_default)
        if isinstance(metadata_column.type, sa.Boolean):
            new_inspected_default = cls.convert_postgres_boolean(
                new_inspected_default)
            new_metadata_default = cls.convert_postgres_boolean(
                new_metadata_default)

        if new_inspected_default != new_metadata_default:
            return True
        return False

    @classmethod
    def render_server_default(cls, type, server_default, autogen_context):
        if type != 'server_default':
            return False

        # For some reason, the default rendering is not doing this correctly, so we need to
        # customize the rendering so that this is handled correctly and it adds the sa.text part
        if isinstance(server_default, TextClause):
            return "sa.text('%s')" % (server_default.text)
        return False

    @classmethod
    def get_clause_text(cls, server_default):
        if server_default is None:
            return server_default

        def strip_default(arg):
            # return the underlying string instead of quoted
            return str(arg).strip("'")

        if isinstance(server_default, TextClause):
            return strip_default(server_default.text)

        if isinstance(server_default, DefaultClause):
            return strip_default(server_default.arg)

        return strip_default(server_default)

    def get_schema_path(self):
        return self.schema_path

    def get_metadata(self):
        return self.metadata

    def get_connection(self):
        return config.connection

    def compute_changes(self):
        migrations = produce_migrations(self.mc, config.metadata)
        return migrations.upgrade_ops.ops

    def run(self):
        diff = self.compute_changes()

        if len(diff) == 0:
            print("schema is up to date")
        else:
            self._apply_changes(diff)

    def _apply_changes(self, diff):
        #pprint.pprint(diff, indent=2, width=20)

        #migration_script = produce_migrations(self.mc, self.metadata)
        # print(render_python_code(migration_script.upgrade_ops))

        # TODO we need a top level upgrade path which is run when we get to production instead of running this
        # we need to only call upgrade() and not revision() and then upgrade()
        self.revision(diff)
        self.upgrade()

    def revision_message(self, diff=None):
        if diff is None:
            migrations = produce_migrations(self.mc, config.metadata)
            diff = migrations.upgrade_ops.ops

        def alter_column_op(op):
            if op.modify_type is not None:
                return 'modify column %s type from %s to %s' % (op.column_name, op.existing_type, op.modify_type)
            elif op.modify_nullable is not None:
                return 'modify nullable value of column %s from %s to %s' % (op.column_name, op.existing_nullable, op.modify_nullable)
            elif op.modify_server_default is not None:
                return 'modify server_default value of column %s from %s to %s' % (
                    op.column_name,
                    Runner.get_clause_text(op.existing_server_default),
                    Runner.get_clause_text(op.modify_server_default))
            else:
                # TODO modify_comment, modify_name all valid options
                return None

        class_name_map = {
            'CreateTableOp': lambda op: 'add %s table' % op.table_name,
            'ModifyTableOps': lambda op: "\n".join([class_name_map[type(child_op).__name__](child_op) for child_op in op.ops]),
            'AlterColumnOp': lambda op: alter_column_op(op),
            'CreateUniqueConstraintOp': lambda op: 'add unique constraint %s' % op.constraint_name,
            'CreateIndexOp': lambda op: 'add index %s' % op.index_name,
            'AddColumnOp': lambda op: 'add column %s to table %s' % (op.column.name, op.table_name),
            # TODO check for this by default
            'AddEdgesOp': lambda op: op.get_revision_message(),
            'RemoveEdgesOp': lambda op: op.get_revision_message(),
            'ModifyEdgeOp': lambda op: op.get_revision_message(),
            'AlterEnumOp': lambda op: op.get_revision_message(),
        }

        changes = [class_name_map[type(op).__name__](op) for op in diff]

        message = "\n".join(changes)
        return message

    def revision(self, diff=None):
        # print(self.cmd.current())

        # if diff is None:
        #   diff = self.compute_changes()

        message = self.revision_message(diff)

        self.cmd.revision(message)

        # understand diff and make changes as needed
        #pprint.pprint(migrations, indent=2, width=30)

    def upgrade(self):
        self.cmd.upgrade()

    def downgrade(self, revision):
        self.cmd.downgrade(revision)

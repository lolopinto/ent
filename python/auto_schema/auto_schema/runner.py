import json
from collections.abc import Mapping
from .diff import Diff
from .clause_text import get_clause_text
import sqlalchemy as sa
from sqlalchemy.sql.elements import TextClause

from alembic.migration import MigrationContext
from alembic.autogenerate import produce_migrations
from alembic.autogenerate import render_python_code
from alembic.util.exc import CommandError

from sqlalchemy.dialects import postgresql
import alembic.operations.ops as alembicops

from . import command
from . import config
from . import ops
from . import renderers
from . import compare
from . import ops_impl
from . import util


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
                "render_item": Runner.render_item,
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
        if isinstance(args, Mapping) and args.get('connection'):
            connection = args.get('connection')
        else:
            engine = sa.create_engine(args.engine)
            connection = engine.connect()

        edges_map = metadata.info.setdefault("edges", {})
        ops_impl.add_edges_from(connection, list(edges_map['public'].values()))

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

        # print(context, inspected_column, metadata_column, inspected_type, metadata_type, type(inspected_type), type(metadata_type))

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

        new_inspected_default = get_clause_text(inspected_default)
        new_metadata_default = get_clause_text(metadata_default)
        if isinstance(metadata_column.type, sa.Boolean):
            new_inspected_default = cls.convert_postgres_boolean(
                new_inspected_default)
            new_metadata_default = cls.convert_postgres_boolean(
                new_metadata_default)

        if new_inspected_default != new_metadata_default:
            # specific case. not sure why this is needed
            # can be generalized at some point in the future
            if isinstance(new_inspected_default, str) and new_inspected_default.startswith("nextval") and metadata_default is None:
                return False
            return True
        return False

    @classmethod
    def render_item(cls, type_, item, autogen_context):
        def server_default():
            # For some reason, the default rendering is not doing this correctly, so we need to
            # customize the rendering so that this is handled correctly and it adds the sa.text part
            if isinstance(item, TextClause):
                return "sa.text('%s')" % (item.text)
            return False

        def enum():
            if isinstance(item, postgresql.ENUM):
                # render postgres with create_type=False so that the type is not automatically created
                # we want an explicit create type and drop type
                # which we apparently don't get by default
                return "postgresql.ENUM(%s, name='%s', create_type=False)" % (util.render_list_csv(item.enums), item.name)
            return False

        type_map = {
            'server_default': server_default,
            'type': enum,
        }

        if type_ in type_map:
            return type_map[type_]()

        return False

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
            return None
        else:
            return self._apply_changes(diff)

    def _apply_changes(self, diff):
        # pprint.pprint(diff, indent=2, width=20)

        # migration_script = produce_migrations(self.mc, self.metadata)
        # print(render_python_code(migration_script.upgrade_ops))

        try:
            self.revision(diff)
        except CommandError as err:
            # expected when not up to date so let's make it up to date by upgrading
            if str(err) == "Target database is not up to date.":
                pass
            else:
                raise err

        return self.upgrade()

    def revision_message(self, diff=None):
        if diff is None:
            migrations = produce_migrations(self.mc, config.metadata)
            diff = migrations.upgrade_ops.ops

        d = Diff(diff, group_by_table=False)
        changes = [c["desc"] for c in d.list_changes()]

        message = "\n".join(changes)
        return message

    def revision(self, diff=None):
        # print(self.cmd.current())

        # if diff is None:
        #   diff = self.compute_changes()

        message = self.revision_message(diff)

        self.cmd.revision(message)

        # understand diff and make changes as needed
        # pprint.pprint(migrations, indent=2, width=30)

    def upgrade(self, revision='head', merge_branches=False):
        return self.cmd.upgrade(revision, merge_branches)

    def downgrade(self, revision, delete_files):
        self.cmd.downgrade(revision, delete_files=delete_files)

    def history(self):
        self.cmd.history()

    def current(self):
        self.cmd.current()

    def show(self, revision):
        self.cmd.show(revision)

    def heads(self):
        self.cmd.heads()

    def branches(self):
        self.cmd.branches()

    def stamp(self, revision):
        self.cmd.stamp(revision)

    def edit(self, revision):
        self.cmd.edit(revision)

    def changes(self):
        diff = self.compute_changes()
        d = Diff(diff, group_by_table=True)
        print(json.dumps(d.changes()))

    def merge(self, revisions, message=None):
        self.cmd.merge(revisions, message=message)

    def squash(self, squash):
        self.cmd.squash(self.revision, squash)

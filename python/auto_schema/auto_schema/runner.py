from argparse import Namespace
import io
import json
import os
import asyncio
import sys
from collections.abc import Mapping
from alembic.operations import Operations
from alembic.util.langhelpers import Dispatcher
from uuid import UUID
from functools import wraps

from .diff import Diff
from .clause_text import get_clause_text
from .clearable_string_io import ClearableStringIO
import sqlalchemy as sa
from sqlalchemy.sql.elements import TextClause
from sqlalchemy.engine.url import make_url

from alembic.autogenerate import produce_migrations
from alembic.autogenerate import RevisionContext
from alembic.autogenerate.api import AutogenContext
from alembic.autogenerate import render_python_code
from alembic.migration import MigrationContext
from alembic import context
from alembic.util.exc import CommandError
from alembic.script import ScriptDirectory

from sqlalchemy.dialects import postgresql
import alembic.operations.ops as alembicops
from typing import Optional, Dict, Any, Union, List, Tuple

from . import command
from . import config
from . import ops
from . import renderers
from . import compare
from . import ops_impl
from . import csv
from .util.os import delete_py_files


class Runner(object):
    def __init__(self, metadata, engine, connection, schema_path, args: Optional[Dict] = None):
        self.metadata = metadata
        self.schema_path = schema_path
        self.engine = engine
        self.connection = connection
        self.args = args or {}

        config.metadata = self.metadata
        config.engine = self.engine
        config.connection = connection

        sql = self.args.get('sql', None)
        if sql is not None and sql.lower() != 'true':
            config.output_buffer = open(sql, 'w')

        self.mc = MigrationContext.configure(
            connection=self.connection,
            opts=Runner.get_opts(),
        )
        self.cmd = command.Command(self.connection, self.schema_path)
        
    @classmethod   
    def get_opts(cls):
        # note that any change here also needs a comparable change in env.py
        return {
                "compare_type": Runner.compare_type,
                "include_object": Runner.include_object,
                "compare_server_default": Runner.compare_server_default,
                "transaction_per_migration": True,
                "render_item": Runner.render_item,
            }

    @classmethod
    def from_command_line(cls, metadata, args: Namespace):
        engine = sa.create_engine(args.engine)
        connection = engine.connect()
        metadata.bind = connection
        return Runner(metadata, engine, connection, args.schema, args=args.__dict__)

    @classmethod
    def fix_edges(cls, metadata, args):
        if isinstance(args, Mapping) and args.get('connection'):
            connection = args.get('connection')
        else:
            engine = sa.create_engine(args.engine)
            connection = engine.connect()

        mc = MigrationContext.configure(
            connection=connection,
        )
        operations = Operations(mc)
        edges_map = metadata.info.setdefault("edges", {})
        ops_impl.add_edges_from(operations, list(edges_map['public'].values()))

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

        new_inspected_default = get_clause_text(
            inspected_default, inspected_column.type)
        new_metadata_default = get_clause_text(
            metadata_default, metadata_column.type)
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
            if isinstance(item, UUID):
                # quote as string so it's rendered correctly
                return "'%s'" % str(item)

            return False

        def enum():
            if isinstance(item, postgresql.ENUM):
                # render postgres with create_type=False so that the type is not automatically created
                # we want an explicit create type and drop type
                # which we apparently don't get by default
                return "postgresql.ENUM(%s, name='%s', create_type=False)" % (csv.render_list_csv(item.enums), item.name)
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

    # sql used for debugging in tests
    def run(self, sql=False):
        diff = self.compute_changes()

        if len(diff) == 0:
            return None
        else:
            return self._apply_changes(diff, sql=sql)

    def _apply_changes(self, diff, sql=False):
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

        return self.upgrade(sql=sql)

    def revision_message(self, diff=None):
        if diff is None:
            migrations = produce_migrations(self.mc, config.metadata)
            diff = migrations.upgrade_ops.ops

        d = Diff(diff, group_by_table=False)
        changes = [c["desc"] for c in d.list_changes()]

        message = "\n".join(changes)
        return message

    def revision(self, diff=None, revision=None):
        # print(self.cmd.current())

        # if diff is None:
        #   diff = self.compute_changes()

        message = self.revision_message(diff)

        self.cmd.revision(message, revision=revision)

        # understand diff and make changes as needed
        # pprint.pprint(migrations, indent=2, width=30)

    def explicit_revision(self, message):
        return self.cmd.revision(message, autogenerate=False)

    def upgrade(self, revision='heads', sql=False):
        return self.cmd.upgrade(revision, sql)

    def downgrade(self, revision, delete_files):
        self.cmd.downgrade(revision, delete_files=delete_files)

    def history(self, verbose=False, last=None, rev_range=None):
        self.cmd.history(verbose=verbose, last=last, rev_range=rev_range)

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

    def squash(self, squash, message=None, database=''):
        if squash == 'all':
            self.squash_all(message, database=database)
        else:
            self.squash_n(squash)
            
    def squash_n(self, squash):
        squash = int(squash)
        if squash < 2:
            raise ValueError("squash needs to be an integer of at least 2")
        
        revision = None
        heads = self.cmd.get_heads()
        if len(heads) == 1:
            revision = heads[0]

        # downgrade -2 and re-run upgrade
        self.cmd.downgrade('-%d' % squash)

        # generate a new revision
        self.revision(revision=revision)
        self.cmd.upgrade()
        
    def squash_all(self, message=None, database=''):
        heads = self.cmd.get_heads()
        if len(heads) > 1:
            raise ValueError("cannot squash_all when there are multiple heads")
        
        revision = heads[0]
        
        location = self.cmd.alembic_cfg.get_main_option('version_locations')
        
        (migrations, connection, dialect, mc) = self.migrations_against_empty(database=database)

        (custom_sql_upgrade_ops, custom_sql_downgrade_ops) = self._get_custom_sql(connection, dialect, as_ops=True)
        migrations.upgrade_ops.ops.extend(custom_sql_upgrade_ops)

        # in practice, shouldn't care about downgrade at this point since if you're doing this, you're past the point
        # of no return but doing it anyway for tests and completeness
        # reverse downgrade_ops
        migrations.downgrade_ops.ops.reverse()
        # reverse custom_sql
        custom_sql_downgrade_ops.reverse()
        # add reversed custom sql since we add them last
        migrations.downgrade_ops.ops.extend(custom_sql_downgrade_ops)
        
        # delete existing files
        asyncio.run(delete_py_files(location))

        message = message or "all the things"
        command_args = dict(
            message=message,
            autogenerate=False,
            sql=False,
            head="head",
            splice=False,
            branch_label=None,
            version_path=None,
            rev_id=revision,
            depends_on=None,
        )
        revision_context = RevisionContext(
            self.cmd.alembic_cfg,
            self.cmd.get_script_directory(),
            command_args,
        )
        migration_script = alembicops.MigrationScript(
            rev_id=revision,
            message=message,
            upgrade_ops=migrations.upgrade_ops,
            downgrade_ops=migrations.downgrade_ops,
            head="head",
            splice=False,
            branch_label=None,
            version_path=None,
            depends_on=None,
        )
        # set up autogenerate code so it renders the migrations
        opts=Runner.get_opts()
        opts['sqlalchemy_module_prefix'] = 'sa.'
        opts['alembic_module_prefix'] = 'op.'
        opts['user_module_prefix'] = None
        opts['render_as_batch'] = False
        autogen_context = AutogenContext(
            mc, autogenerate=False,
            opts=opts,
        )
        revision_context._last_autogen_context = autogen_context

        migration_script._needs_render = True

        # writes the file and we can do something with the script if we want but we don't need to
        revision_context._to_script(migration_script)
        

    def _get_custom_sql(self, connection, dialect, as_buffer=False, as_ops=False) -> Union[io.StringIO, Tuple[List[alembicops.MigrateOperation], List[alembicops.MigrateOperation]]]:
        if not as_ops ^ as_buffer:
            raise ValueError("must specify either as_buffer or as_ops")

        custom_sql_include_all = config.metadata.info.setdefault('custom_sql_include', {})
        custom_sql_exclude_all= config.metadata.info.setdefault('custom_sql_exclude', {})
        custom_sql_include_list = custom_sql_include_all.setdefault('public', [])
        custom_sql_exclude_list = custom_sql_exclude_all.setdefault('public', [])
        
        custom_sql_include = None
        custom_sql_exclude = None
        
        if len(custom_sql_include_list) > 0:
            custom_sql_include = set(custom_sql_include_list)
        if len(custom_sql_exclude_list) > 0:
            custom_sql_exclude = set(custom_sql_exclude_list)
            
        def is_custom_op(obj: ops.ExecuteSQL):
            return isinstance(obj, ops.ExecuteSQL) or isinstance(obj, alembicops.ExecuteSQLOp)

        def include_rev(name: str):
            if custom_sql_include is not None:
                return name in custom_sql_include
            if custom_sql_exclude is not None:
                return name not in custom_sql_exclude
            return True
     

        script_directory = self.cmd.get_script_directory()
        revs = script_directory.walk_revisions()
        
        # this is cleared after each upgrade
        temp_buffer = ClearableStringIO()

        opts = Runner.get_opts()
        opts['as_sql'] = True
        opts['output_buffer'] = temp_buffer
        mc = MigrationContext.configure(
            connection=connection,
            dialect_name=dialect,
            opts=opts,
        )
        
        custom_sql_buffer = io.StringIO()

        # monkey patch the Dispatcher.dispatch method to know what's being changed/dispatched
        # for each upgrade path, we'll know what the last object was and can make decisions based on that
        
        last_ops = []

        def my_decorator(func):
            @wraps(func)
            def wrapper(self, *args, **kwargs):
                nonlocal last_ops
                last_ops.append(args[0])
                return func(self, *args, **kwargs)  
            return wrapper   
            
        Dispatcher.dispatch = my_decorator(Dispatcher.dispatch)

        # order is flipped, it goes from most recent to oldest
        # we want to go from oldest -> most recent 
        revs = list(revs)
        revs.reverse()

        upgrade_ops = []
        downgrade_ops = []
        with Operations.context(mc):
            for rev in revs:
                # run upgrade(), we capture what's being changed via the dispatcher and see if it's custom sql 
                rev.module.upgrade()

                header_written = False
                if include_rev(rev.revision):
                    # the number of ops should match the number of sql chunks written
                    # may eventually have ops that do more than 1 sql write and need to handle this differently???
                    assert len(last_ops) == temp_buffer.chunk_len()

                    for i in range(len(last_ops)):
                        op = last_ops[i]
                        if is_custom_op(op):
                            if as_buffer:
                                chunk = temp_buffer.get_chunk(i)
                                if not header_written:
                                    custom_sql_buffer.write("-- custom sql for rev %s\n" % rev.revision)
                                    header_written = True
                                    
                                # only write if chunk is custom op 
                                custom_sql_buffer.write(chunk)

                            if as_ops:
                                upgrade_ops.append(op)

                    last_ops = []


                    # run downgrade, capture what's being changed via the dispatcher and see if it's custom sql                        
                    rev.module.downgrade()
                    for op in last_ops:
                        if is_custom_op(op):
                            downgrade_ops.append(op)

                last_ops = []

                temp_buffer.clear()
        
        if as_ops:
            return (upgrade_ops, downgrade_ops)

        return custom_sql_buffer
    
    def migrations_against_empty(self, database=''):
        dialect = self.connection.dialect.name

        raw_engine = self.args.get('engine', None)
        if raw_engine is None:
            raise ValueError("must specify engine")

        # use passed in database. make sure not None
        url = make_url(raw_engine).set(database=database or '')

        engine = sa.create_engine(url)
        connection = engine.connect()

        metadata = sa.MetaData()
        metadata.reflect(bind=connection)
        if len(metadata.sorted_tables) != 0:
            raise Exception("to compare from base tables, cannot have any tables in database. have %d" % len(
                metadata.sorted_tables))

        mc = MigrationContext.configure(
            connection=connection,
            dialect_name=dialect,
            opts=Runner.get_opts(),
        )
        migrations = produce_migrations(mc, self.metadata) 
        return (migrations, connection, dialect, mc)
                    
    # doesn't invoke env.py. completely different flow
    # progressive_sql and upgrade range do go through offline path
    def all_sql(self, file=None, database=''):
        (migrations, connection, dialect, mc) = self.migrations_against_empty(database=database)
    
        # default is stdout so let's use it
        buffer = sys.stdout
        if file is not None:
            buffer = open(file, 'w')

        # use different migrations context with as_sql so that we don't have issues
        opts = Runner.get_opts()
        opts['as_sql'] = True
        opts['output_buffer'] = buffer
        mc2 = MigrationContext.configure(
            connection=connection,
            opts=opts
        )

        # let's do a consistent (not runtime dependent) sort of constraints by using name instead of _creation_order
        @property
        def sort_constraints_by_name(self):
            return sorted(self.constraints, key=lambda c: c.name)

        prev_sort = sa.Table._sorted_constraints
        sa.Table._sorted_constraints = sort_constraints_by_name

        def invoke(op):
            if isinstance(op, alembicops.OpContainer):
                for op2 in op.ops:
                    invoke(op2)
            else:
                operations.invoke(op)

        operations = Operations(mc2)

        # create alembic table to start
        mc2._version.create(bind=mc2.connection)

        for op in migrations.upgrade_ops.ops:
            invoke(op)
        
        custom_sql_buffer = self._get_custom_sql(connection, dialect, as_buffer=True)

        # add custom sql at the end
        buffer.write(custom_sql_buffer.getvalue())
        buffer.close()
        
        # restore this
        sa.Table._sorted_constraints = prev_sort
        


    def progressive_sql(self, file=None):
        if file is not None:
            config.output_buffer = open(file, 'w')

        self.upgrade('base:heads', sql=True)

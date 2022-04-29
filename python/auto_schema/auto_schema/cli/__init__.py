import os
import sys
import traceback
import argparse
import warnings
import alembic

import sqlalchemy

# if env variable is set, manipulate the path to put local
# current directory over possibly installed auto_schema so that we
# see local changes
if os.getenv('LOCAL_AUTO_SCHEMA') == 'true':
    sys.path.insert(0, os.getcwd())


# run from auto_schema root. conflicts with pip-installed auto_schema when that exists so can't have
# that installed when runnning this...
from auto_schema.runner import Runner

from importlib import import_module

parser = argparse.ArgumentParser(
    description="generate the db schema for an ent", prog='auto_schema')
required = parser.add_argument_group('required arguments')
required.add_argument(
    '-s', '--schema', help='path to the folder the generated schema file is in', required=True)
required.add_argument(
    '-e', '--engine', help='URL to connect to the database', required=True)
parser.add_argument('-f', '--fix_edges', help='fix edges in schema into db')
parser.add_argument('-u', '--upgrade', help='upgrade')
# this is getting bad and needs to be changed soon to something that's more extensible and makes more sense
parser.add_argument('-d', '--downgrade', help='downgrade')
# only applies when downgrading, default is deleting file since it's auto created by schema
parser.add_argument('--keep_schema_files', action='store_true')
parser.add_argument('--history', help='alembic history',
                    action='store_true')
parser.add_argument('--current', help='alembic current', action='store_true')
parser.add_argument(
    '--verbose', help='alembic history --verbose', action='store_true')
parser.add_argument('--last', help='alembic history --verbose --last N')
parser.add_argument(
    '--rev_range', help='alembic history --rev_range revn:current')
parser.add_argument('--show', help='show revision')
parser.add_argument('--heads', help='alembic heads', action='store_true')
parser.add_argument('--branches', help='alembic branches', action='store_true')
parser.add_argument('--stamp', help='alembic stamp')
parser.add_argument('--edit', help='alembic edit')
parser.add_argument('--merge', help='alembic merge')
parser.add_argument('--message', help='message if alembic merge is called')
parser.add_argument('--squash', help='squash the last N changes into one')
parser.add_argument(
    '--changes', help='get changes in schema', action='store_true')
parser.add_argument(
    '--debug', help='if debug flag passed', action='store_true')

# see https://alembic.sqlalchemy.org/en/latest/offline.html
# if true, pased to u
parser.add_argument(
    '--sql', help='passed to upgrade to indicate that we should spit out sql needed for changes. if true, sql is output to stdout. if file, sql is stored in file')

# spits out sql to create a new database from scratch. compares against the base postgres database
# expects no types or databases
parser.add_argument(
    '--all_sql', help='get all the sql commands that should be run to create db', action='store_true'
)
# spits out sql to incrementally update the database as needed
# it goes through each revision and emits the change. much slower and all_sql should be preferred
parser.add_argument(
    '--progressive_sql', help='get all the sql commands that should be run to create db', action='store_true'
)
parser.add_argument(
    '--file', help='output file for sql generated instead of output buffer. used w/ --all_sql, --progressive_sql or --sql'
)
parser.add_argument(
    '--run_and_all_sql', help='run and all_sql combined so we do not call into this multiple times', action='store_true'
)
# if none is provided, it defaults to the database associated with the username
parser.add_argument(
    '--empty_database', help='with --all_sql or --run_and_all_sql, we need an empty database to compare against',
)


def main():
    with warnings.catch_warnings():
        # ignore warnings for now
        # TODO https://github.com/lolopinto/ent/issues/852
        warnings.simplefilter('ignore')

        try:
            args = parser.parse_args()
            sys.path.append(os.path.relpath(args.schema))

            schema = import_module('schema')
            metadata = schema.get_metadata()

            if args.fix_edges:
                Runner.fix_edges(metadata, args)
            else:
                r = Runner.from_command_line(metadata, args)
                if args.upgrade is not None:
                    r.upgrade(revision=args.upgrade, sql=args.sql)
                elif args.downgrade is not None:
                    r.downgrade(args.downgrade, not args.keep_schema_files)
                elif args.history is True:
                    r.history(verbose=args.verbose, last=args.last,
                              rev_range=args.rev_range)
                elif args.current is True:
                    r.current()
                elif args.heads is True:
                    r.heads()
                elif args.branches is True:
                    r.branches()
                elif args.show is not None:
                    r.show(args.show)
                elif args.stamp is not None:
                    r.stamp(args.stamp)
                elif args.edit is not None:
                    r.edit(args.edit)
                elif args.changes:
                    r.changes()
                elif args.merge is not None:
                    r.merge(args.merge, args.message)
                elif args.squash is not None:
                    r.squash(args.squash)
                elif args.all_sql is True:
                    r.all_sql(file=args.file, database=args.empty_database)
                elif args.progressive_sql is True:
                    r.progressive_sql(file=args.file)
                else:
                    r.run()
                    if args.run_and_all_sql:
                        r.all_sql(file=args.file, database=args.empty_database)

        except Exception as err:
            if args.debug:
                print(args)
            sys.stderr.write("auto_schema error: "+str(err))
            if args.debug or os.getenv('LOCAL_AUTO_SCHEMA') == 'true':
                traceback.print_exception(*sys.exc_info())


# no logic should be in here. everything in main()
if __name__ == '__main__':
    main()

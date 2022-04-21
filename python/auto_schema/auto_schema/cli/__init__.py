import os
import sys
import argparse
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
# this may not be what i want since it'll do all changes...
parser.add_argument(
    '--all_sql', help='get all the sql commands that should be run to create db', action='store_true'
)


def main():
    # try:
    args = parser.parse_args()

    sys.path.append(os.path.relpath(args.schema))

    schema = import_module('schema')
    metadata = schema.get_metadata()

    if args.fix_edges:
        Runner.fix_edges(metadata, args)
    else:
        print(args)
        r = Runner.from_command_line(metadata, args)
        if args.upgrade is not None:
            r.upgrade(revision=args.upgrade)
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
            # need a compare None -> schema as it exists immediately

            r.all_sql()

#            r.upgrade('base:heads', sql=True)
            # alembic_versions
            # get each table -> output create().
            # we need compare to work... because of things like index...
            # get each edge -> output add edge
            # get dbrows -> output insert into

        else:
            r.run()
    # except Exception as err:
    #     sys.stderr.write("auto_schema error: "+str(err))


if __name__ == '__main__':
    main()

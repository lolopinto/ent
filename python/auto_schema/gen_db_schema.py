import os 
import sys
import argparse

from auto_schema import runner

from importlib import import_module

parser = argparse.ArgumentParser(description="generate the db schema for an ent")
parser.add_argument('--schema', metavar='S', help='path to the folder the generated schema file is in')
parser.add_argument('--engine', metavar='E', help='URL to connect to the database')

if __name__ == "__main__" :
  # TODO we need to support running each of the alembic commands directly e.g. upgrade head, upgrade +1, downgrade -1, current, history, etc
  # so we need even more complicated things here

  args = parser.parse_args()
  sys.path.append(os.path.relpath(args.schema))

  schema = import_module('schema')
  metadata = schema.get_metadata()
  
  r = runner.Runner(metadata, args.engine, args.schema)
  r.run()
  
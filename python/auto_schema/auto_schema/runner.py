import pprint

from sqlalchemy import (create_engine)

from alembic.migration import MigrationContext
from alembic.autogenerate import compare_metadata
from alembic.autogenerate import produce_migrations
from alembic.autogenerate import render_python_code

import sys
from . import command
from . import config

class Runner(object):

  def __init__(self, metadata, database_uri, schema_path):
    self.metadata = metadata
    self.database_uri = database_uri
    self.schema_path = schema_path

    # save in config for access by env.py
    config.metadata = self.metadata
    config.engine = create_engine(database_uri)

    self.mc = MigrationContext.configure(config.engine.connect())
    self.cmd = command.Command(config.engine, self.schema_path)


  def get_schema_path(self):
    return self.schema_path

  def get_metadata(self):
    return self.metadata

  def get_engine(self):
    return config.engine

  def compute_changes(self):
    diff = compare_metadata(self.mc, config.metadata)
    return diff


  def run(self):
    diff = self.compute_changes()
  
    if len(diff) == 0:
      print("nothing to do here")
    else:
      self._apply_changes(diff)

  def _apply_changes(self, diff):
    pprint.pprint(diff, indent=2, width=20)

    #migration_script = produce_migrations(self.mc, self.metadata)
    #print(render_python_code(migration_script.upgrade_ops))

    self.revision()
    self.upgrade()

  def revision(self, message="schema change"):
    #print(self.cmd.current())

    self.cmd.revision(message)

    # understand diff and make changes as needed
    #pprint.pprint(migrations, indent=2, width=30)

  def upgrade(self):
    self.cmd.upgrade()
    

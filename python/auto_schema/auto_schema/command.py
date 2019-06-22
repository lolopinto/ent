import os

from alembic.config import Config
from alembic import command

class Command(object):

  def __init__(self, engine, schema_path):
    alembic_cfg = Config()

    # script location is where we're running this from so keep that local
    alembic_cfg.set_main_option("script_location", os.path.dirname(__file__))
    #print("env.py location", os.path.dirname(__file__))

    alembic_cfg.set_main_option("version_locations", os.path.join(schema_path, "versions"))

    self.alembic_cfg = alembic_cfg

    # pass connection instead of re-creating it and using a sqlalchemy_url file
    with engine.begin() as connection:
      alembic_cfg.attributes['connection'] = connection

  # Returns the current revision of the database. Same as calling `alembic current`
  def current(self):
    command.current(self.alembic_cfg, verbose=True)

  # Simulates running the `alembic revision -m` command
  # TODO autogenerate the message based on reading the schema
  def revision(self, message):
    command.revision(self.alembic_cfg, message, autogenerate=True)

  # Simulates running the `alembic upgrade` command
  def upgrade(self, revision='head'):
    command.upgrade(self.alembic_cfg, revision)
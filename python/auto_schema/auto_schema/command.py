import os

from alembic.config import Config
from alembic import command

class Command(object):

  def __init__(self, connection, schema_path):
    alembic_cfg = Config()

    # script location is where we're running this from so keep that local
    alembic_cfg.set_main_option("script_location", os.path.dirname(__file__))
    #print("env.py location", os.path.dirname(__file__))

    alembic_cfg.set_main_option("version_locations", os.path.join(schema_path, "versions"))

    # should probably make some of these configurable eventually
    alembic_cfg.set_main_option("file_template", "%%(rev)s_%%(year)d%%(month)d%%(day)d%%(hour)d%%(minute)d%%(second)d_%%(slug)s")
    alembic_cfg.set_main_option("truncate_slug_length", "40")
    alembic_cfg.set_main_option("timezone", "utc") # use utc timezone.

    self.alembic_cfg = alembic_cfg

    # pass connection instead of re-creating it and using a sqlalchemy_url file
    alembic_cfg.attributes['connection'] = connection

  # Returns the current revision of the database. Same as calling `alembic current`
  def current(self):
    command.current(self.alembic_cfg, verbose=True)

  # Simulates running the `alembic revision -m` command
  def revision(self, message):
    command.revision(self.alembic_cfg, message, autogenerate=True)

  # Simulates running the `alembic upgrade` command
  def upgrade(self, revision='head'):
    command.upgrade(self.alembic_cfg, revision)
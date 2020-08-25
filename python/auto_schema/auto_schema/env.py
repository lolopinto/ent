
from logging.config import dictConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# env.py apparently cannot be relative because of how it's loaded.
from auto_schema import config
from auto_schema import runner

# these 4 needed for custom ops (edges, enums etc)
from auto_schema import ops
from auto_schema import renderers
from auto_schema import compare
from auto_schema import ops_impl

# set a bunch of loggic parameters based on default info in `alembic init as of 6/15/2019`
log_config = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            # 'args': '(sys.stderr,)',
            'stream': 'ext://sys.stdout',
            'level': 'NOTSET',
            'formatter': 'generic'
        }
    },
    'loggers': {
        'root': {
            'level': 'WARN',
            'handlers': ['console'],
            'qualname': ''
        },
        'sqlalchemy': {
            'level': 'WARN',
            'handlers': '',
            'qualname': 'sqlalchemy.engine'
        },
        'alembic': {
            'level': 'INFO',
            'handlers': '',
            'qualname': 'alembic'
        }
    },
    'formatters': {
        'generic': {
            'format': '%(levelname)-5.5s [%(name)s] %(message)s',
            'datefmt': '%H:%M:%S'
        }
    }
}
dictConfig(log_config)

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
target_metadata = config.metadata

# connection engine...
#engine = config.engine
connection = config.connection

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.

# set the target metadata that we'll use here
# def set_metadata(metadata):
#     target_metadata = metadata

# def set_engine(engine):
#     engine = engine


# TODO this hasn't been fully tested or doesn't work...
def run_migrations_offline():
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=runner.Runner.compare_type,
        include_object=runner.Runner.include_object,
        compare_server_default=runner.Runner.compare_server_default,
        render_item=runner.Runner.render_server_default,
        # transaction_per_migration doesn't seem to apply offline
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """

    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=runner.Runner.compare_type,
        include_object=runner.Runner.include_object,
        compare_server_default=runner.Runner.compare_server_default,
        render_item=runner.Runner.render_item,
        transaction_per_migration=True
    )

    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

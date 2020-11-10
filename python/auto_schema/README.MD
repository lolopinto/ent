This takes a [sqlalchemy](https://www.sqlalchemy.org/) schema and applies [alembic](https://alembic.sqlalchemy.org/en/latest/) migrations.

It's used by the ent framework on top of  [alembic autogenerate](https://alembic.sqlalchemy.org/en/latest/autogenerate.html) to ensure that all supported schema types are automatically handled.

Will beef up this README eventually and add examples later.

Called as follows: `python3 auto_schema -s={pathToSchema} -e={engineURL}`.

Only supports Postgres DB at the moment.
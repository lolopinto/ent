---
sidebar_position: 2
sidebar_label: "CLI"
---

# CLI
`tsent` is the name of the CLI that's used to interact with the schema.

It's used when run via Docker or when [run locally](/docs/advanced-topics/running-locally).

Here are the current supported commands:

## codegen
`codegen` is the mostly commonly used command. It reads the schema, validates it and does the following changes:
* updates the database if there's been any changes
* generates the code for the Ent and GraphQL layer

You can filter to only run one "step" if you don't want to run all steps.

Currently, there are 3 steps:
* `db`: only updates the database schema
* `codegen`: only updates the generated Ent layer
* `graphql`: only updates the GraphQL layer.

You should probably always run all steps but if you need to filter, the option is there.

Run as follows:
```shell
tsent codegen
```

or via docker:
```shell
npm run codegen # (via) ent-starter OR
docker-compose -f docker-compose.dev.yml run --rm app tsent codegen
```

To run just one step:

```shell
tsent codegen --step graphql
```

## upgrade
`upgrade` is used to update the database. Most commonly used after pulling from `main` or [when deploying](/docs/advanced-topcs/deploying) to upgrade the database in case there have been any changes.

Run as follows:
```shell
tsent upgrade
```

or via docker:
```shell
npm run upgrade # (via) ent-starter OR
docker-compose -f docker-compose.dev.yml run --rm app tsent upgrade
```

To upgrade to a specific revision, possibly after [downgrading](#downgrade):

```shell
docker-compose -f docker-compose.dev.yml run --rm app tsent upgrade {rev}
```

or via docker:
```shell
docker-compose -f docker-compose.dev.yml run --rm app tsent upgrade {rev}
```

## downgrade
`downgrade` is used to downgrade the database. Used to revert back to a previous database revision. 

To downgrade 1 revision: 

```shell:
tsent downgrade -- -1
```

or via docker:
```shell
docker-compose -f docker-compose.dev.yml run --rm app tsent downgrade -- -1
```

To downgrade to a specific revision:

```shell
docker-compose -f docker-compose.dev.yml run --rm app tsent downgrade {rev}
```

or via docker:
```shell
docker-compose -f docker-compose.dev.yml run --rm app tsent downgrade {rev}
```

## fix-edges
Fixes the [edges](/docs/ent-schema/edges#assoc-edge-config-table) in the database if corrupted for some reason. It basically goes through the schema and tries to reinsert all edges. If already in the database, does nothing.

## alembic
Runs [alembic commands](https://alembic.sqlalchemy.org/en/latest/api/commands.html).

For example, to show the current database revision:

```shell
tsent alembic current
```

or to show the database history:

```shell
tsent alembic history
```
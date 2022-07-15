---
sidebar_position: 3
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

Other flags:

### write-all

To speed up codegen, we don't always generate all the files anytime codegen is run. We try and detect changes between current and last codegen run and only touch files based on what has changed. It's possible there are bugs and we need to generate everything, this allows one to do that.

### disable_custom_graphql

To disable custom graphql during codegen. Used when we need to rebuild everything and minimize parsing code. Can be used when there's conflicts and you want to regenerate the generated code first

### disable_prompts

Disables prompts which asks the developer interactive questions. Use with care.

## upgrade

`upgrade` is used to update the database. Most commonly used after pulling from `main` or [when deploying](/docs/advanced-topics/deploying) to upgrade the database in case there have been any changes.

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
tsent upgrade {rev}
```

or via docker:

```shell
docker-compose -f docker-compose.dev.yml run --rm app tsent upgrade {rev}
```

## downgrade

`downgrade` is used to downgrade the database. Used to revert back to a previous database revision.

### downgrade 1 revision

```shell:
tsent downgrade -- -1
```

or via docker:

```shell
docker-compose -f docker-compose.dev.yml run --rm app tsent downgrade -- -1
```

### downgrade 2 revisions

```shell:
tsent downgrade -- -2
```

or via docker:

```shell
docker-compose -f docker-compose.dev.yml run --rm app tsent downgrade -- -2
```

### downgrade to a specific revision

```shell
tsent downgrade {rev}
```

or via docker:

```shell
docker-compose -f docker-compose.dev.yml run --rm app tsent downgrade {rev}
```

### downgrade and keep schema files

This can be used when working on multiple branches at the same time.

If you want to switch from one branch to another and want to change database back to a common ancestor:

```shell
tsent downgrade --keep_schema_files -- -1
```

or via docker:

```shell
docker-compose -f docker-compose.dev.yml run --rm app tsent downgrade --keep_schema_files -- -1
```

### downgrade one revision in a branch

It's possible to end up with multiple branches. This can happen when multiple people make changes to the database from a common ancestor.

For example, git branch `main` is at `rev1`.

Developer A makes a change in a feature branch with rev `rev2a` e.g. adding a nullable column `foo` to table `users`.

Developer B makes a change in a feature branch with rev `rev2b` e.g. adding a nullable column `bar` to table `users`.

Both are committed to main.

Main now has 2 heads: `rev2a` and `rev2b`.

If you want to downgrade for any reason, the basic downgrade doesn't work. You'll have to be more specific and can do so as follows:

```shell
tsent downgrade rev2a@rev1
```

or via docker:

```shell
docker-compose -f docker-compose.dev.yml run --rm app tsent downgrade rev2a@rev1
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
tsent alembic history --verbose 
tsent alembic history --verbose --last 4
tsent alembic history --verbose --rev_range rev1:current
```

Current supported commands:

* upgrade
* downgrade
* history
* current
* heads
* branches
* show
* stamp

## delete_schema

Deletes the given schema.

```shell
tsent delete_schema Holiday
```

or via docker

```shell
docker-compose -f docker-compose.dev.yml run --rm app tsent delete_schema Holiday
```

## squash

Squashes the last N revisions into one. It's mainly used to make it easier to keep a clean history. It's currently implemented naively by downgrading the last N and detecting all the most recent changes into one.

Consider these workflows for example when iterating:

* add nullable column `foo_id` and run `codegen`
* add nullable column `bar_id` and run `codegen`
* add nullable column `status` and run `codegen`
* decide you don't actually need `bar_id` and run `codegen`

now you have 4 changes when it'd be more ideal to just have 1 change:

you can run

```shell
tsent squash 4
```

or via docker

```shell
docker-compose -f docker-compose.dev.yml run --rm app tsent squash 4
```

which will take the last 4 changes and combine them into one migration file

Another common reason for squash is getting feedback during code review about changes in the schema and you want to commit a simple final version instead of N changes.

## detect_dangling

Detects any dangling schema files. We try and delete unused generated files but may miss some. This goes through the codegen process and detects files which were generated and flags those which weren't changed.

```shell
tsent detect_dangling
```

or via docker

```shell
docker-compose -f docker-compose.dev.yml run --rm app tsent detect_dangling
```

It takes a flag `--delete` to indicate if we should delete any detected files.

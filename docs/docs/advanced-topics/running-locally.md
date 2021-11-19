---
sidebar_position: 6
---

# Running Locally

You may notice that running via Docker is slow. The preferred way to address this is to use [docker-sync](/docs/advanced-topics/docker-sync) to speed things up. Another approach is to get all the dependencies and run things locally.

There's 3 major runtimes we use:

* TypeScript: all the production code is in TypeScript
* Go: the CLI and orchestration
* Python: For the database migrations. We use the [Alembic](https://alembic.sqlalchemy.org/en/latest/) framework.

Here's the steps to install locally:

* Install [golang](https://golang.org/doc/install#download) version of 1.17.1
* Get the latest version of the Ent CLI:

```shell
go install github.com/lolopinto/ent/tsent@v0.0.32
```

* Install [Python](https://www.python.org/downloads/) >= 3.8
  + Ensure you have `pip` [installed](https://pip.pypa.io/en/stable/installing/)
* Install [autoschema](https://pypi.org/project/auto-schema/):

```shell
python3 -m pip install auto_schema==0.0.12
```

* Install the following TypeScript packages globally:

```shell
npm install -g typescript@4.4.2 prettier@2.3.2 ts-node@10.2.1
```

* Install `tsconfig-paths` locally:

```shell
npm install --save-dev tsconfig-paths@3.11.0
```

You should now have everything you need to run locally.

You'd need to check this page regularly in case one of the dependencies has changed.

Check out the [CLI](/docs/advanced-topics/cli) to see what the supported commands are.

When running locally, we have to pass the database connection to the CLI, there are two ways to do this:

## DB_CONNECTION_STRING

Env variable `DB_CONNECTION_STRING` .
Run as follows:

```shell
  DB_CONNECTION_STRING=postgres://ola:@localhost/ent-starter tsent codegen
```

Note the change from `host.docker.internal` in `docker-compose.dev.yml` from the `ent-starter` repository to `localhost` .

## config/database.yml

To specify the database connection parts, can put the details in a yml file: `config/database.yml`

```yml title="config/database.yml"
dialect: postgres
database: ent-starter
user: ola
password: '' 
host: localhost
port: 5432
pool: 5
sslmode: disable

```

Run as follows:

```shell
  tsent codegen
```

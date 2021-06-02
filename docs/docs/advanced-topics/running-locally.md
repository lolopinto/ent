---
sidebar_position: 1
---

# Running Locally
You may notice that running via Docker is slow. It's something that we eventually need to fix. For now, the workaround is to run things locally.

There's 3 major runtimes we use: 

* TypeScript: all the production code is in TypeScript
* Go: the CLI and orchestration
* Python: For the database migrations. We use the [Alembic](https://alembic.sqlalchemy.org/en/latest/) framework.


Here's the steps to install locally:
* Install latest version of [golang](https://golang.org/doc/install#download)
* Get the latest version of the Ent CLI:
 
```shell
go install github.com/lolopinto/ent/tsent@v0.0.13
```
* Install [Python](https://www.python.org/downloads/) >= 3.8
  - Ensure you have `pip` [installed](https://pip.pypa.io/en/stable/installing/)
* Install [autoschema](https://pypi.org/project/auto-schema/): 

```shell
python3 -m pip install auto_schema==0.0.7
```

* Install the following TypeScript packages globally: 

```shell
npm install -g ts-node prettier typescript
```
* Install `tsconfig-paths` locally: 

```shell
npm install --save-dev tsconfig-paths
```

You should now have everything you need to run locally.

You'd need to check this page regularly in case one of the dependencies has changed.

Check out the [CLI](/docs/advanced-topics/cli) to see what the supported commands are.

When running locally, we have to pass the database connection to the CLI, there are two ways to do this:

## DB_CONNECTION_STRING

Env variable `DB_CONNECTION_STRING`. 
Run as follows:

```shell
  DB_CONNECTION_STRING=postgres://ola:@localhost/ent-starter tsent codegen
```

Note the change from `host.docker.internal` in `docker-compose.dev.yml` from the `ent-starter` repository to `localhost`.

## config/database.yml
To specify the database connection parts, can put the details in a yml file: `config/database.yml`

```yml title="config/database.yml"
dialect: postgres
database: ent-starter
user: ola
password: '' 
host: localhost
port: 5432
pool: 5 # ¯\_(ツ)_/¯ 
sslmode: disable
```

Run as follows:

```shell
  tsent codegen
```

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
go install github.com/lolopinto/ent/tsent@v0.0.11
```
* Install [Python](https://www.python.org/downloads/) >= 3.8
  - Ensure you have `pip` [installed](https://pip.pypa.io/en/stable/installing/)
* Install [autoschema](https://pypi.org/project/auto-schema/): 

```shell
python3 -m pip install auto_schema==0.0.6
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
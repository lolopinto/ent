# README

To speed up docker commands, we use [docker-sync](https://docker-sync.readthedocs.io/en/latest/index.html).

Prerequisites:

Follow [installation](https://docker-sync.readthedocs.io/en/latest/getting-started/installation.html) steps. I only needed to do:

```shell
gem install docker-sync
```

And then run `docker-sync start` prior to running any docker commands and `docker-sync stop` afterwards.

This has only been tested on mac OSX. We currently use the default [sync strategy](https://docker-sync.readthedocs.io/en/latest/advanced/sync-strategies.html).

TODO: Need to apparently run `docker-sync stop` and `docker-sync start` periodically. If you see any errors that indicate missing files but local development is working, here's a possible reason.

## Bun mode

This example is Bun-first for codegen, runtime, and tests:

- `runtime: bun`
- `postgresDriver: bun`

- `npm run codegen` runs the local Bun-backed codegen path against the code in this repo
- `npm test` runs the example test suite with `bun test`
- `npm run runtime:smoke` runs a Bun runtime smoke test against a temporary database using Bun's native Postgres driver
- `npm run start-fast` starts the GraphQL server locally through `bun`

Docker still uses a local example Dockerfile. Build the shared base image first from [`ts/Dockerfile`](/Users/ola/code/ent/ts/Dockerfile:1):

```shell
cd ../../ts
docker build -t ent .
```

Then `npm run start` will build the example image on top of that shared base and boot the app with Bun.

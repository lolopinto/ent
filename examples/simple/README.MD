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

This example is checked in as Bun-first for codegen/runtime config:

- `runtime: bun`
- `postgresDriver: bun`

Node remains directly testable via explicit override scripts.

Docker now uses the shared [`ts/Dockerfile`](/Users/ola/code/ent/ts/Dockerfile:1) image directly and overrides the container command to Bun for this example. That means:

- `npm run start` runs the app in Docker with `bun src/graphql/index.bun.ts`
- `npm run codegen` runs the local Bun-backed codegen path against the code in this repo
- `npm run codegen:docker` runs `tsent codegen` in the shared Docker image as a container smoke path
- the image still contains `node`, `bun`, `yarn`, and `tsent`, so the same base can be reused with different commands

Bun-specific entry points are additive:

- `npm run codegen:node` runs codegen through the default Node path
- `npm run codegen:bun` runs the full Bun-backed codegen pass, including custom GraphQL discovery
- `npm test` runs the full example test suite with `bun test`
- `npm run runtime:node` runs a Node runtime smoke test using the default runtime and Postgres driver selection
- `npm run start-fast:bun` starts the GraphQL server through `bun`
- `npm run runtime:bun` runs a Bun runtime smoke test against a temporary database using Bun's native Postgres driver

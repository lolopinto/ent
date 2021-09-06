---
sidebar_position: 2
sidebar_label: "Deploying"
---

# Deploying

If using the [ent-starter](https://github.com/lolopinto/ent-starter) repository, here are the following things that need to be done to deploy:

* add `DB_CONNECTION_STRING` environment variable pointing to the database connection string
* add `PORT` environment variable with value `80`

Deploy to a Docker environment with the `Dockerfile` in the ent-starter repository as the Dockerfile used.

That installs dependencies, compiles, [upgrades](/docs/advanced-topics/cli#upgrade) the database and starts the Node server.

As your application gets more complicated, modify as needed to suit your needs.

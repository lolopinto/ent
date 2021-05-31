---
sidebar_position: 3
sidebar_label: "Deploying"
---

# Deploying
If using the [ent-starter](https://github.com/lolopinto/ent-starter) repository, here are the following things that need to be done to deploy:

* add `DB_CONNECTION_STRING` environment variable pointing to the database connection string
* add `PORT` environment variable with value `80` 
* add a secret `.npmrc` file with value:

```
//npm.pkg.github.com/:_authToken={token}
@lolopinto:registry=https://npm.pkg.github.com/
```

where `{token}` is a [Github Personal Access Token](https://docs.github.com/en/github/authenticating-to-github/keeping-your-account-and-data-secure/creating-a-personal-access-token).

Deploy to a Docker environment with the `Dockerfile` in the ent-starter repository as the dockerfile used.

That installs dependencies, compiles, [upgrades](/docs/advanced-topics/cli#upgrade) the database and starts the Node server.

As your application gets more complicated, modify as needed to suit your needs.
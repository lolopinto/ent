---
sidebar_position: 5
---

# Docker Sync

You may notice that running via Docker is slow. The preferred way to address this is to use use [docker-sync](https://docker-sync.readthedocs.io/en/latest/index.html) to speed things up. Another is to [run locally](/docs/advanced-topics/running-locally) but that involves keeping up to date with dependencies as they change.

* [Install docker-sync](https://docker-sync.readthedocs.io/en/latest/getting-started/installation.html) via

```shell
gem install docker-sync
```

* Create a file `docker-sync.yml` at the root of your application:

```yml title="docker-sync.yml"
version: '2'
syncs:
  simple-sync:
    src: './'
    compose-file-path: docker-compose.dev.yml
```

* Update your `docker-compose.dev.yml` as follows:

```yml title="docker-compose.dev.yml"
version: '3.8'

services:
  app:
    build: 
      context: .
      dockerfile: develop.Dockerfile
    container_name: example_app
    ports: 
      - 4000:4000
      - 9229:9229
    volumes: 
      - simple-sync:/app/:nocopy #  nocopy is important
    environment:
      - DB_CONNECTION_STRING=postgres://ola:@host.docker.internal/tsent_test

volumes:
  simple-sync:
    external: true
```

Major changes above:

1. `simple-sync` volume added in the `volumes` section at the bottom of the file
2. volume of the app updated to use the `simple-sync` volume defined at the bottom of the file

* Run `docker-sync start` once prior to any docker commands such as `npm run codegen`.

* Run `docker-sync stop` once done.

There's more [advanced](https://docker-sync.readthedocs.io/en/latest/getting-started/configuration.html) [options](https://docker-sync.readthedocs.io/en/latest/advanced/sync-strategies.html) here but that's out of the scope of this guide.

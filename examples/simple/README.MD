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

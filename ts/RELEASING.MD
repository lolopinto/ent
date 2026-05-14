# Releasing Docker

We use a Github Action to release a new docker image anytime anything relevant changes e.g. auto_schema, golang release etc.

To update the Docker image, following steps are needed:

Update `Dockerfile` and run `docker build -t ent .` locally to confirm simple Docker image builds locally.

Use `docker container run -it ent /bin/zsh` if you want to run anything on the docker image e.g. to test different commands in isolation.

**New docker image?**

* Update `release_image/docker_version.txt` by bumping e.g. from `v0.3.3` to `v0.3.4`.

**Auto schema change?**

* Update `release_image/auto_schema_version.txt` for the new `auto_schema` version.
* Update `auto_schema` version in `docs/docs/advanced-topics/running-locally.md`.
* Also update `AUTO_SCHEMA_VERSION` arg at the top of `Dockerfile`.

**New Golang release/tag?**

* Update `release_image/tsent_version.txt` for the new golang release version.
* Update the version in the `go install...` line in `docs/docs/advanced-topics/running-locally.md`.
* Also update `GOLANG_VERSION` arg at the top of `Dockerfile`.
* Run `go install github.com/lolopinto/ent/tsent@{TSENT_VERSION}` locally from different folder to try and get the new version in [GOPROXY](https://proxy.golang.org/).

To manually reproduce locally, we're high level following [these steps](https://docs.github.com/en/free-pro-team@latest/packages/managing-container-images-with-github-container-registry/pushing-and-pulling-docker-images#authenticating-to-github-container-registry):

We use [buildx](https://docs.docker.com/buildx/working-with-buildx/#build-multi-platform-images) to build a multi-arch image

* Update `Dockerfile`
* `echo "{TOKEN}" | docker login ghcr.io -u USERNAME --password-stdin`
* `docker buildx create --use` to create a new builder
* `docker buildx build --platform linux/arm64,linux/amd64 --tag ghcr.io/lolopinto/ent:v0.0.23-test --push .` to build and push new image

If just testing, don't use `latest` tag above.

Currently, can't get the multi-arch image to be built on an M1 mac so needs to be built on an intel mac.

PS: To figure out what the new version/tag should be, current version can be found [here](https://github.com/users/lolopinto/packages/container/package/ent).

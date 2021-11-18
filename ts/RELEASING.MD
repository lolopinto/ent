# Releasing Docker

We use a Github Action to release a new docker image anytime anything relevant changes e.g. auto_schema, golang release etc

To update the Docker image, following steps are needed:

* Update `TAG` const in `release_image/main.go` by bumping e.g. from `0.0.17` to `0.0.18`
* Update `AUTO_SCHEMA_VERSION` in `release_image/main.go` const for new `auto_schema` version or `TSENT_VERSION` const for new golang `tsent` release version
* Also update `GOLANG_VERSION`, or `AUTO_SCHEMA_VERSION` or `NODE_VERSION` args at the top of `Dockerfile` so that is up to date.
* Update `auto_schema` and `tsent` versions in `docs/docs/advanced-topics/runnng-locally.md` so that the latest versions are being used there.
* Run `go install github.com/lolopinto/ent/tsent@v{TAG}` locally from different folder to try and get the new version in [GOPROXY](https://proxy.golang.org/).

To update locally, we're high level following [these steps](https://docs.github.com/en/free-pro-team@latest/packages/managing-container-images-with-github-container-registry/pushing-and-pulling-docker-images#authenticating-to-github-container-registry):

We use [buildx](https://docs.docker.com/buildx/working-with-buildx/#build-multi-platform-images) to build a multi-arch image

* Update `Dockerfile`
* `echo "{TOKEN}" | docker login ghcr.io -u USERNAME --password-stdin`
* `docker buildx create --use` to create a new builder
* `docker buildx build --platform linux/arm64,linux/amd64 --tag ghcr.io/lolopinto/ent:v0.0.23-test --push .` to build and push new image

If just testing, don't use `latest` tag above.

Currently, can't get the multi-arch image to be built on an M1 mac so needs to be built on an intel mac.

PS: To figure out what the new version/tag should be, current version can be found [here](https://github.com/users/lolopinto/packages/container/package/ent).

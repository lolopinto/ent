# Releasing Docker

We use a Github Action to release a new docker image anytime anything relevant changes e.g. auto_schema, golang release etc

To update the Docker image, following steps are needed:

* update `ts/Dockerfile.tmpl`for new `auto_schema` version or golang `tsent` release version
* Update `TAG` const in  `release_image/main.go` by bumping e.g. from `0.0.17` to `0.0.18` 
* Also update `Dockerfile` so that Dockerfile is up to date.

To update locally, we're high level following [these steps](https://docs.github.com/en/free-pro-team@latest/packages/managing-container-images-with-github-container-registry/pushing-and-pulling-docker-images#authenticating-to-github-container-registry):

We use [buildx](https://docs.docker.com/buildx/working-with-buildx/#build-multi-platform-images) to build a multi-arch image

* Update `Dockerfile`
* `echo "{TOKEN}" | docker login ghcr.io -u USERNAME --password-stdin`
* `docker buildx create --use` to create a new builder
* `docker buildx build --platform linux/arm64,linux/amd64 --tag ghcr.io/lolopinto/ent:(tag) --tag ghcr.io/lolopinto/ent:latest --push .` to build and push new image

If just testing, don't use `latest` tag above.

Currently, can't get the multi-arch image to be built on an M1 mac so needs to be built on an intel mac. 

PS: To figure out what the new version/tag should be, current version can be found at https://github.com/users/lolopinto/packages/container/package/ent.
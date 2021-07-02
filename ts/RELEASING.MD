## Releasing Docker
Steps to update docker image:

high level following [these steps](https://docs.github.com/en/free-pro-team@latest/packages/managing-container-images-with-github-container-registry/pushing-and-pulling-docker-images#authenticating-to-github-container-registry):

We use [buildx](https://docs.docker.com/buildx/working-with-buildx/#build-multi-platform-images) to build a multi-arch image

* `echo "{TOKEN}" | docker login ghcr.io -u USERNAME --password-stdin`
* `docker buildx create --use` to create a new builder
* `docker buildx build --platform linux/arm64,linux/amd64 --tag ghcr.io/lolopinto/ent:(tag) --tag ghcr.io/lolopinto/ent:latest --push .` to build and push new image

Currently, can't get the multi-arch image to be built on an M1 mac so needs to be built on an intel mac. 

PS: To figure out what the new version/tag should be, current version can be found at https://github.com/users/lolopinto/packages/container/package/ent.
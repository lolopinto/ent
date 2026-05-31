# Releasing Docker Images

Docker image releases are separate from publishing `auto_schema`, npm packages,
or Go tags. Do not update `release_image/*.txt` unless intentionally cutting a
new Docker image.

Docker image PRs validate the requested image contents without registry
credentials or image pushes. After the PR is merged, the `push` workflow on
`main` builds and pushes the image.

To update the Docker image, the following steps are needed:

Update `Dockerfile` and run `docker build -t ent .` locally to confirm the
simple Docker image builds locally.

Use `docker container run -it ent /bin/zsh` if you want to run anything on the docker image e.g. to test different commands in isolation.

**New docker image?**

* Update `release_image/docker_version.txt` by bumping e.g. from `v0.3.3` to `v0.3.4`.

**Auto schema change in the Docker image?**

* Update `release_image/auto_schema_version.txt` for the new `auto_schema` version.
* Also update `AUTO_SCHEMA_VERSION` arg at the top of `Dockerfile`.

**New Golang release/tag in the Docker image?**

* Update `release_image/tsent_version.txt` for the new golang release version.
* Also update `GOLANG_VERSION` arg at the top of `Dockerfile`.
* Run `go install github.com/lolopinto/ent/tsent@{TSENT_VERSION}` locally from different folder to try and get the new version in [GOPROXY](https://proxy.golang.org/).

The pull request workflow checks that `release_image/auto_schema_version.txt`
or `release_image/tsent_version.txt` changes are paired with
`release_image/docker_version.txt`, verifies the referenced published versions,
tests the release image tooling, and renders the Dockerfiles without pushing.

To render release image files locally without building or pushing:

* `cd release_image && DB_CONNECTION_STRING=sqlite:/// go run .`

To manually reproduce a push locally, we're high level following [these steps](https://docs.github.com/en/free-pro-team@latest/packages/managing-container-images-with-github-container-registry/pushing-and-pulling-docker-images#authenticating-to-github-container-registry):

We use [buildx](https://docs.docker.com/buildx/working-with-buildx/#build-multi-platform-images) to build a multi-arch image

* Update `Dockerfile`
* `echo "{TOKEN}" | docker login ghcr.io -u USERNAME --password-stdin`
* `cd release_image && DB_CONNECTION_STRING=sqlite:/// go run . --push` to build and push the release image variants

If just testing, use the default no-push command instead of `--push`.

Currently, can't get the multi-arch image to be built on an M1 mac so needs to be built on an intel mac.

PS: To figure out what the new version/tag should be, current version can be found [here](https://github.com/users/lolopinto/packages/container/package/ent).

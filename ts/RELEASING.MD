## Releasing Docker
Steps to update docker image:

high level following [these steps](https://docs.github.com/en/free-pro-team@latest/packages/managing-container-images-with-github-container-registry/pushing-and-pulling-docker-images#authenticating-to-github-container-registry):

* `echo "{TOKEN}" | docker login ghcr.io -u USERNAME --password-stdin`
* `docker build --no-cache -t ent .`
* `docker tag ent ghcr.io/lolopinto/ent:(tag)`
* `docker tag ent ghcr.io/lolopinto/ent:latest`

* `docker push ghcr.io/lolopinto/ent` for latest
* `docker push ghcr.io/lolopinto/ent:(tag)`

PS: To figure out what the new version/tag should be, current version can be found at https://github.com/users/lolopinto/packages/container/package/ent.
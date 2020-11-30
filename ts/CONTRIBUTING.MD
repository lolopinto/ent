Steps to update docker image:

* `docker build  --build-arg GITHUB_TOKEN={token} --no-cache -t ent .`
* `docker tag ent ghcr.io/lolopinto/ent:(tag)`
* `docker push ghcr.io/lolopinto/ent` for latest tag
* `docker push ghcr.io/lolopinto/ent:(0.0.1)`

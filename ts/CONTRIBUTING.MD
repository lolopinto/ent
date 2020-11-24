Steps to update docker image:

* `docker build  --build-arg GITHUB_TOKEN={token} --no-cache -t ent .`
* `docker tag ent lolopinto/ent(:{tag})`
* `docker push lolopinto/ent(:{tag})`

FROM ghcr.io/lolopinto/ent:v0.2.0-alpha.11-nodejs-22-dev

WORKDIR /app

RUN apt-get update && apt-get install build-essential -yqq

COPY . .

CMD ["node", "dist/graphql/index.js"]

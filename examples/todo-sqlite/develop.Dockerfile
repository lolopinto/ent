FROM ghcr.io/lolopinto/ent:v0.1.14-nodejs-18-dev

WORKDIR /app

RUN apt-get update && apt-get install build-essential -yqq

COPY . .

CMD ["node", "dist/graphql/index.js"]

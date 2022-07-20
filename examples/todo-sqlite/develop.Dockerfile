FROM ghcr.io/lolopinto/ent:0.1.0-alpha.12-nodejs-17-dev

WORKDIR /app

RUN apt-get update && apt-get install build-essential -yqq

COPY . .

CMD ["node", "dist/graphql/index.js"]

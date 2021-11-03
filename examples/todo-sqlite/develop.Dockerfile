FROM ghcr.io/lolopinto/ent:0.0.30-nodejs-16-dev

WORKDIR /app

RUN apt-get update && apt-get install build-essential -yqq

COPY . .

CMD ["node", "dist/graphql/index.js"]

FROM ghcr.io/lolopinto/ent:v0.3.2-nodejs-18-dev

WORKDIR /app

RUN apt-get update && apt-get install build-essential -yqq

COPY . .

CMD ["node", "dist/graphql/index.js"]

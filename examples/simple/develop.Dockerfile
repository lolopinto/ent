FROM ghcr.io/lolopinto/ent:v0.2.0-alpha.12-test-nodejs-22-dev

WORKDIR /app

COPY . .

CMD ["node", "dist/graphql/index.js"]

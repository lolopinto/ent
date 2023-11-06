FROM ghcr.io/lolopinto/ent:v0.1.13-nodejs-18-dev

WORKDIR /app

COPY . .

CMD ["node", "dist/graphql/index.js"]
FROM ghcr.io/lolopinto/ent:v0.1.10-nodejs-18-dev

WORKDIR /app

COPY . .

CMD ["node", "dist/graphql/index.js"]

FROM ghcr.io/lolopinto/ent:0.1.0-alpha.12-nodejs-17-dev

WORKDIR /app

COPY . .

CMD ["node", "dist/graphql/index.js"]

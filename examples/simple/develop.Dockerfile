FROM ghcr.io/lolopinto/ent:0.0.21-nodejs-16-dev

WORKDIR /app

COPY . .

CMD ["node", "dist/graphql/index.js"]

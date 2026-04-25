FROM ghcr.io/lolopinto/ent:v0.3.2-nodejs-24-dev

WORKDIR /app

COPY . .

CMD ["node", "dist/graphql/index.js"]

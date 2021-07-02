FROM ghcr.io/lolopinto/ent:0.0.17

WORKDIR /app

COPY . .

CMD ["node", "dist/graphql/index.js"]
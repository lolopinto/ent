FROM ghcr.io/lolopinto/ent:v0.0.23

WORKDIR /app

COPY . .

CMD ["node", "dist/graphql/index.js"]

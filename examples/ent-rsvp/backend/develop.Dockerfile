FROM ghcr.io/lolopinto/ent:0.0.5

WORKDIR /app

COPY . /app

CMD ["node", "dist/graphql/index.js"]
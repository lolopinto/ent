FROM ghcr.io/lolopinto/ent:v0.3.12-nodejs-24-dev

WORKDIR /app

COPY . .

CMD ["bun", "src/graphql/index.bun.ts"]

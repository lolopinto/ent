FROM ent

WORKDIR /app

COPY . .

CMD ["bun", "src/graphql/index.bun.ts"]

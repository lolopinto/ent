FROM ghcr.io/lolopinto/ent:0.0.8

WORKDIR /app

COPY . /app

RUN npm run compile
RUN npm run upgrade

CMD ["node", "dist/graphql/index.js"]
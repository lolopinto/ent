FROM ghcr.io/lolopinto/ent:v0.1.17-nodejs-18-dev

WORKDIR /app

COPY . /app

RUN rm -rf node_modules 

ENV NODE_ENV=production
RUN npm install --production
RUN npm run compile

ARG DB_CONNECTION_STRING=$DB_CONNECTION_STRING
ENV DB_CONNECTION_STRING=$DB_CONNECTION_STRING

RUN tsent upgrade

CMD ["node", "dist/graphql/index.js"]
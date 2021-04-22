FROM ghcr.io/lolopinto/ent:0.0.8

WORKDIR /app

COPY . /app

RUN rm -rf node_modules && rm package-lock.json && npm install 
RUN npm run compile

ARG DB_CONNECTION_STRING=$DB_CONNECTION_STRING
ENV DB_CONNECTION_STRING=$DB_CONNECTION_STRING

RUN tsent upgrade

CMD ["node", "dist/graphql/index.js"]
FROM ghcr.io/lolopinto/ent:0.0.30-nodejs-16-slim

# TODO this needs to be tested for "production"
# works locally when run here but needs to be tested in hostile environments

ENV NODE_ENV=production
ARG GITHUB_TOKEN  
WORKDIR /app

COPY package.json /app/package.json
COPY .docker_npmrc /app/.docker_npmrc
# in production don't need both
RUN cp .docker_npmrc .npmrc


RUN npm install --production
RUN rm -f .npmrc .docker_npmrc

COPY . /app

# TODO doesn't work yet see below
#RUN npm run compile

# this is needed to make it work without previously running compile
#RUN node dist/graphql/index.js

# this is needed to make it work so that tsent and other commands run locally
# there's something clearly rotten somewhere but will move on for now 
CMD ["node", "dist/graphql/index.js"]

FROM lolopinto/ent

ARG NPM_TOKEN  
WORKDIR /app

#COPY ["package.json", ".docker_npmrc", "./"]
COPY package.json /app/package.json
COPY .docker_npmrc /app/.docker_npmrc
RUN cp .docker_npmrc .npmrc


RUN npm install 
RUN rm -f .npmrc .docker_npmrc

COPY . /app

#RUN npm run compile

# this is needed to make it work without previously running compile
#RUN node dist/graphql/index.js

# this is needed to make it work so that tsent and other commands run locally
# there's something clearly rotten somewhere but will move on for now 
CMD ["node", "dist/graphql/index.js"]

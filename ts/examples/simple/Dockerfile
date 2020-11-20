FROM lolopinto/ent

# how do we configure this? we want this to be development/test/production as needed
#ENV NODE_ENV=production
ARG NPM_TOKEN  
WORKDIR /app

#COPY ["package.json", ".docker_npmrc", "./"]
COPY package.json /app/package.json
COPY .docker_npmrc /app/.docker_npmrc
RUN cp .docker_npmrc .npmrc

COPY . /app

RUN npm install 
RUN rm -f .npmrc .docker_npmrc
#RUN mv /app/node_modules  /node_modules


# # ok we're missing a bunch of steps here
# # how to get ts-node etc?
# # we don't have that in node-modules 
# # we need compiler.ts in here
# # so that we can just do "node src/graphql/index.ts"
# # compiler.ts is in here so we don't need that 


RUN npm run compile

RUN node dist/graphql/index.js
#CMD ["node" "dist/graphql/index.js"]

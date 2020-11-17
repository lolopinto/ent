FROM lolopinto/ent

# how do we configure this? we want this to be development/test/production as needed
#ENV NODE_ENV=production
ARG NPM_TOKEN  
WORKDIR /app

COPY ["package.json", "package-lock.json*", ".docker_npmrc", "./"]
RUN cp .docker_npmrc .npmrc

# will not be needed eventually but needed right now since all these packages are still private
#COPY ["$HOME/.npmrc ", "./"]

RUN npm install 
RUN rm -f .npmrc .docker_npmrc

# TODO maybe mount this?
COPY . .

# # ok we're missing a bunch of steps here
# # how to get ts-node etc?
# # we don't have that in node-modules 
# # we need compiler.ts in here
# # so that we can just do "node src/graphql/index.ts"
# # compiler.ts is in here so we don't need that 

RUN npm run compile

CMD ["node", "dist/graphql/index.js"]  

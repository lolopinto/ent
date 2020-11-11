FROM node:12.18.1

# how do we configure this? we want this to be development/test/production as needed
ENV NODE_ENV=production
ARG NPM_TOKEN  

WORKDIR /app

COPY ["package.json", "package-lock.json*", ".npmrc", "./"]

# will not be needed eventually but needed right now since all these packages are still private
#COPY ["$HOME/.npmrc ", "./"]

RUN npm install --production
RUN rm -f .npmrc

COPY . .

# # ok we're missing a bunch of steps here
# # how to get ts-node etc?
# # we don't have that in node-modules 
# # we need compiler.ts in here
# # so that we can just do "node src/graphql/index.ts"
# # compiler.ts is in here so we don't need that 

RUN npm run compile

CMD ["node", "src/graphql/index.ts"]  

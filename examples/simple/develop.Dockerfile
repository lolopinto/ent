FROM ghcr.io/lolopinto/ent:0.0.11

WORKDIR /app

COPY . /app

# TODO doesn't work yet see below
#RUN npm run compile

# this is needed to make it work without previously running compile
#RUN node dist/graphql/index.js

# this is needed to make it work so that tsent and other commands run locally
# there's something clearly rotten somewhere but will move on for now 
CMD ["node", "dist/graphql/index.js"]

FROM nikolaik/python-nodejs:python3.8-nodejs14

# this is associating this image with this repo
LABEL org.opencontainers.image.source https://github.com/lolopinto/ent

RUN apt update && apt --assume-yes install zsh

# install auto_schema
RUN python3 -m pip install auto_schema==0.0.7

# get go
RUN wget https://storage.googleapis.com/golang/go1.16.3.linux-amd64.tar.gz

RUN tar -C /usr/local -xzf go1.16.3.linux-amd64.tar.gz

ENV PATH $PATH:/usr/local/go/bin

# default path but make it explicit
ENV GOPATH=$HOME/go
ENV GOBIN $GOPATH/bin
ENV PATH $PATH:$GOPATH/bin

RUN go install github.com/lolopinto/ent/tsent@v0.0.13

# needed to tell tsent where to get tsconfig-paths + make it possible to test locally 
ENV TSCONFIG_PATHS="/node_modules/tsconfig-paths/register"

# first 3 need to move from ts/package.json
# maybe typescript?
RUN npm install -g ts-node prettier typescript
# this needs to be local apparently
RUN npm install --save-dev tsconfig-paths 

CMD ["node"]

# TODO eventually need a production Dockerfile that's lighter than this...
# don't need ts-node, prettier, tsconfig-paths for example

# still need go, python and node tho because of CLI and db 
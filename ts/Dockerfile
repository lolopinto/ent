FROM nikolaik/python-nodejs:python3.8-nodejs14

# this is associating this image with this repo
LABEL org.opencontainers.image.source https://github.com/lolopinto/ent

RUN apt update && apt --assume-yes install zsh

# install auto_schema
RUN python3 -m pip install auto_schema==0.0.5

# get go
RUN wget https://storage.googleapis.com/golang/go1.16.3.linux-amd64.tar.gz

RUN tar -C /usr/local -xzf go1.16.3.linux-amd64.tar.gz

ENV PATH $PATH:/usr/local/go/bin

ARG GITHUB_TOKEN=$GITHUB_TOKEN
RUN go env -w GOPRIVATE=github.com/lolopinto/ent
#ENV GOPRIVATE github.com/lolopinto/ent
RUN git config --global url."https://golang:$GITHUB_TOKEN@github.com".insteadOf "https://github.com"

# default path but make it explicit
ENV GOPATH=$HOME/go
#ENV PATH $PATH:$GOPATH/bin
ENV GOBIN $GOPATH/bin
ENV PATH $PATH:$GOPATH/bin

#RUN git config credential.https://github.com/lolopinto lolopinto
#ENV rm -rf $GOPATH/pkg/mod/github.com/lolopinto
#ENV GO111MODULE=on

#COPY .netrc .netrc
#RUN cd $GOROOT
#RUN go get github.com/lolopinto/ent@v0.0.9
#RUN 
# RUN git clone https://golang:$GITHUB_TOKEN@github.com/lolopinto/ent.git
# RUN cd ent && git checkout tags/v0.0.9
# RUN cd ent && go mod edit -replace github.com/lolopinto/ent=/ent
# RUN cd ent/tsent && go install .

#RUN pwd
# WORKDIR $GOPATH/src/github.com/lolopinto/ent/tsent
# RUN pwd
RUN go install github.com/lolopinto/ent/tsent@v0.0.9

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
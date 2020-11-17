#FROM node:14.15.0 as node-build
#FROM nikolaik/python3.8-nodejs14-alpine:latest
FROM nikolaik/python-nodejs:python3.8-nodejs14

# FROM python:3 
# COPY --from=node-build /usr/local/bin/node /usr/local/bin/node
# COPY --from=node-build /usr/local/bin/npm /usr/local/bin/npm
# needed for pg
#RUN apt-get install libpq-dev
# needed to get postgresql dev to be able to install psycopg2-binary

# libpq-dev python-dev not available
# RUN apk add postgresql-dev \
#   gcc \ 
#   linux-headers && \ 

# install auto_schema
RUN python3 -m pip install auto_schema

# get go
RUN wget https://storage.googleapis.com/golang/go1.14.12.linux-amd64.tar.gz

# need golang after all to get?
RUN tar -C /usr/local -xzf go1.14.12.linux-amd64.tar.gz

ENV PATH $PATH:/usr/local/go/bin

#RUN git config --global url."git@github.com:".insteadOf "https://github.com/"
#RUN git config --global url."https://$NPM_TOKEN:x-oauth-basic@github.com/".insteadOf "https://github.com/"
#RUN machine github.com login lolopinto PASSWORD $NPM_TOKEN

ARG NPM_TOKEN=$NPM_TOKEN
RUN go env -w GOPRIVATE=github.com/lolopinto
RUN echo $NPM_TOKEN
RUN git config --global url."https://golang:$NPM_TOKEN@github.com".insteadOf "https://github.com"

# default path but make it explicit
ENV GOPATH=$HOME/go
ENV PATH $PATH:$GOPATH/bin
# hmm this isn't good because this isn't versioned and it's never deployed and we're always getting master basically
RUN go get github.com/lolopinto/ent/tsent
#RUN go install 

# these 3 need to move from ts/package.json
RUN npm install -g ts-node
RUN npm install -g prettier
RUN npm install -g tsconfig-paths

CMD ["node"]

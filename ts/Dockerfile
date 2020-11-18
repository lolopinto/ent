FROM nikolaik/python-nodejs:python3.8-nodejs14

RUN apt update && apt --assume-yes install zsh

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
RUN git config --global url."https://golang:$NPM_TOKEN@github.com".insteadOf "https://github.com"

# default path but make it explicit
ENV GOPATH=$HOME/go
ENV PATH $PATH:$GOPATH/bin
# hmm this isn't good because this isn't versioned and it's never deployed and we're always getting master basically
RUN go get github.com/lolopinto/ent/tsent
#RUN go install 

# first 3 need to move from ts/package.json
# maybe typescript?
RUN npm install -g ts-node prettier typescript
# this needs to be local apparently
RUN npm install --save-dev tsconfig-paths 

CMD ["node"]

# TODO eventually need a production Dockerfile that's lighter than this...
# don't need ts-node, prettier, tsconfig-paths for example

# still need go, python and node tho because of CLI and db 
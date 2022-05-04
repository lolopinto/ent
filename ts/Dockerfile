ARG GOLANG_VERSION=v0.0.38
ARG AUTO_SCHEMA_VERSION=0.0.17
ARG NODE_VERSION=17
ARG DOCKER_TAG=0.0.37

# get and install tsent
FROM golang:1.17.9-buster As golang-image
ARG GOLANG_VERSION
ARG DOCKER_TAG
ENV GOPATH=$HOME/go
ENV GOBIN $GOPATH/bin
ENV PATH $PATH:$GOPATH/bin
RUN go install -ldflags="-X 'github.com/lolopinto/ent/internal/build_info.DockerVersion=$DOCKER_TAG' -X 'github.com/lolopinto/ent/internal/build_info.Time=$(date)'" github.com/lolopinto/ent/tsent@$GOLANG_VERSION

# get and install auto_schema
FROM python:3.8.11-buster AS python-image
ARG AUTO_SCHEMA_VERSION
RUN python -m venv /opt/venv
# Make sure we use the virtualenv
ENV PATH /opt/venv/bin:$PATH

RUN python3 -m pip install auto_schema==$AUTO_SCHEMA_VERSION
#RUN python3 -m pip install --index-url https://test.pypi.org/simple/ --extra-index-url https://pypi.org/simple/ auto_schema_test==$AUTO_SCHEMA_VERSION

# final image needs to be python-based to have auto-schema work
FROM python:3.8.11-slim AS final-image
ARG GOLANG_VERSION
ARG NODE_VERSION

ENV PATH /opt/venv/bin:$PATH
ENV PATH /go/bin:$PATH

# this is associating this image with this repo
LABEL org.opencontainers.image.source https://github.com/lolopinto/ent

# install node and dependencies
RUN \
  apt-get update && \
  # wget and gnupg are dependencies needed below
  # libpq-dev for libpq
  apt-get install -yqq wget gnupg libpq-dev curl && \
  # add architecture needed for arm64 builds
  dpkg --add-architecture amd64 && \
  curl -LO https://github.com/BurntSushi/ripgrep/releases/download/13.0.0/ripgrep_13.0.0_amd64.deb && dpkg -i ripgrep_13.0.0_amd64.deb && \
  #  echo "deb https://deb.nodesource.com/node_$NODE_VERSION.x/ buster main" > /etc/apt/sources.list.d/nodesource.list && \
  #  wget -qO- https://deb.nodesource.com/gpgkey/nodesource.gpg.key | apt-key add - && \
  echo "deb https://dl.yarnpkg.com/debian/ stable main" > /etc/apt/sources.list.d/yarn.list && \
  wget -qO- https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - && \
  curl -fsSL https://deb.nodesource.com/setup_$NODE_VERSION.x | bash - && \
  apt-get update && \
  apt-get install -yqq nodejs yarn && \
  apt-get autoremove wget -yqq && \
  rm -rf /var/lib/apt/lists/*

# these next ones are not included in slim variants

RUN apt update && apt --assume-yes install zsh && \
  rm -rf /var/lib/apt/lists/*
RUN npm install -g typescript@4.4.2 prettier@2.3.2 ts-node@10.7 @swc/core@1.2.155 @swc/cli@0.1.55

WORKDIR /app
RUN npm install --save-dev tsconfig-paths@3.11.0

COPY --from=golang-image /go/bin/tsent /go/bin/tsent
# NOTE: if ever debugging in docker image, code is at 
# /opt/venv/lib/python3.8/site-packages/auto_schema/
COPY --from=python-image /opt/venv /opt/venv
# RUN alias auto_schema=auto_schema_test
COPY --from=golang-image /go/pkg/mod/github.com/lolopinto/ent@$GOLANG_VERSION /go/pkg/mod/github.com/lolopinto/ent@$GOLANG_VERSION

CMD ["node"]


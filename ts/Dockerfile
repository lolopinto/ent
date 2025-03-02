ARG GOLANG_VERSION=v0.2.0-alpha.13
ARG AUTO_SCHEMA_VERSION=0.0.32
ARG NODE_VERSION=18
ARG DOCKER_TAG=v0.2.0-alpha.13-test

# get and install tsent
FROM --platform=$BUILDPLATFORM golang:1.23.3-bullseye As golang-image
ARG GOLANG_VERSION
ARG DOCKER_TAG
ENV GOPATH=$HOME/go
ENV GOBIN $GOPATH/bin
ENV PATH $PATH:$GOPATH/bin
ARG TARGETOS TARGETARCH
# TODO go install works on its own but not the mounts with "read-only file system"
# RUN --mount=target=. \
# --mount=type=cache,target=/root/.cache/go-build \
# --mount=type=cache,target=/go/pkg \
RUN GOOS=$TARGETOS GOARCH=$TARGETARCH go install -ldflags="-X 'github.com/lolopinto/ent/internal/build_info.DockerVersion=$DOCKER_TAG' -X 'github.com/lolopinto/ent/internal/build_info.Time=$(date)'" github.com/lolopinto/ent/tsent@$GOLANG_VERSION

# get and install auto_schema
FROM python:3.11.0-bullseye AS python-image
ARG AUTO_SCHEMA_VERSION
RUN python -m venv /opt/venv
# Make sure we use the virtualenv
ENV PATH /opt/venv/bin:$PATH

RUN python3 -m pip install auto_schema==$AUTO_SCHEMA_VERSION
#RUN python3 -m pip install --index-url https://test.pypi.org/simple/ --extra-index-url https://pypi.org/simple/ auto_schema_test==$AUTO_SCHEMA_VERSION

# final image needs to be python-based to have auto-schema work
FROM python:3.11.0-slim AS final-image
ARG GOLANG_VERSION
ARG NODE_VERSION

ENV PATH /opt/venv/bin:$PATH
ENV PATH /go/bin:$PATH

# this is associating this image with this repo
LABEL org.opencontainers.image.source https://github.com/lolopinto/ent

# install node and dependencies
# TODO platform specific stuff in the node layers here...
RUN \
  apt-get update && \
  # wget and gnupg are dependencies needed below
  # libpq-dev for libpq
  apt-get install -y --no-install-recommends \
  wget gnupg libpq-dev curl ca-certificates ripgrep gnupg && \
  mkdir -p /etc/apt/keyrings && \
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_VERSION.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list && \
  apt-get update && \
  apt-get install nodejs -yqq yarn && \
  apt-get autoremove wget -yqq && \
  rm -rf /var/lib/apt/lists/*

# these next ones are not included in slim variants

RUN apt update && apt --assume-yes install zsh && \
  rm -rf /var/lib/apt/lists/*
RUN npm install -g typescript@5.3.2 prettier@3.1.0 ts-node@11.0.0-beta.1 @swc/core@1.3.100 @swc/cli@0.1.63 @biomejs/biome@1.4.1

WORKDIR /app
RUN npm install --save-dev tsconfig-paths@4.2.0 @swc-node/register@1.6.8

COPY --from=golang-image /go/bin/tsent /go/bin/tsent
# NOTE: if ever debugging in docker image, code is at 
# /opt/venv/lib/python3.8/site-packages/auto_schema/
COPY --from=python-image /opt/venv /opt/venv
# RUN alias auto_schema=auto_schema_test
COPY --from=golang-image /go/pkg/mod/github.com/lolopinto/ent@$GOLANG_VERSION /go/pkg/mod/github.com/lolopinto/ent@$GOLANG_VERSION

CMD ["node"]


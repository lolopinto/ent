FROM python:3 AS auto_schema_dep
#WORKDIR /usr/src/app

RUN python -m venv /opt/venv
# add venv to path
ENV PATH="/opt/venv/bin:$PATH"

RUN python3 -m pip install auto_schema
#FROM golang:1.14

# NEED TO LOGIN TO GIT IN DOCKER??? TO MAKE THIS WORK

# TODO shouldn't need the golang part. tsent should be part of npm
FROM golang:1.14
WORKDIR /usr/src/app 
# TODO do we need a path?
RUN go get github.com/lolopinto/ent
RUN go install -v ./tsent

#FROM golang 
#FROM node:14.15.0
#COPY ["package.json", "package-lock.json*", ".npmrc", "./"]
#WORKDIR /usr/src/app

COPY --from=auto_schema_dep /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
#RUN npm install 
#RUN rm -f .npmrc

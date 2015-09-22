# Dockerfile for aws-sdk-playground
FROM node:0.12
MAINTAINER Raymond Cheng <me@raymondcheng.net>
USER root

# npm
RUN npm install -g grunt-cli
RUN npm install -g gulp
RUN npm install -g bower

# Add the freedom repository
ADD . /aws-sdk-playground
WORKDIR /aws-sdk-playground
RUN npm install


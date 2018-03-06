#!/bin/bash

version=${1:-`cat package.json | jq -r '.version'`}

docker build . -t "projectriff/node-function-invoker:latest"
docker tag "projectriff/node-function-invoker:latest" "projectriff/node-function-invoker:${version}"

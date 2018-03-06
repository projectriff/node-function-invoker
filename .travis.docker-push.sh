#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

version=`cat package.json | jq -r '.version'`

./build.sh $version
docker tag "projectriff/node-function-invoker:${version}" "projectriff/node-function-invoker:${version}-ci-${TRAVIS_COMMIT}"

docker login -u "$DOCKER_USERNAME" -p "$DOCKER_PASSWORD"
docker push "projectriff/node-function-invoker"

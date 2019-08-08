#!/bin/bash

version=${1:-`cat package.json | jq -r '.version'`}
commit=$(git rev-parse HEAD)

gcloud auth activate-service-account --key-file <(echo $GCLOUD_CLIENT_SECRET | base64 --decode)

yarn pack

package=projectriff-node-function-invoker-${version}.tgz
bucket=gs://projectriff/node-function-invoker/releases

gsutil cp -a public-read ${package} ${bucket}/v${version}/node-function-invoker-${version}.tgz
gsutil cp -a public-read ${package} ${bucket}/v${version}/snapshots/node-function-invoker-${version}-${commit}.tgz
gsutil cp -a public-read ${package} ${bucket}/latest/node-function-invoker.tgz

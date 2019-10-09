#!/bin/bash

version=${1:-`cat package.json | jq -r '.version'`}
commit=$(git rev-parse HEAD)

package=projectriff-node-function-invoker-${version}.tgz
bucket=gs://projectriff/node-function-invoker/releases

gsutil cp -a public-read ${package} ${bucket}/v${version}/node-function-invoker-${version}.tgz
gsutil cp -a public-read ${package} ${bucket}/v${version}/snapshots/node-function-invoker-${version}-${commit}.tgz
gsutil cp -a public-read ${package} ${bucket}/latest/node-function-invoker.tgz

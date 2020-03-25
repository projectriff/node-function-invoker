#!/bin/bash

set -Eeuo pipefail

NVM_SOURCE=${NVM:-/usr/local/opt/nvm/nvm.sh}
# shellcheck source=/dev/null
source "${NVM_SOURCE}"

supported_node_versions=(10 12 13)
for node_version in "${supported_node_versions[@]}"; do
	nvm use "${node_version}" \
	&& npm --silent rebuild 1>/dev/null \
	&& npm --silent install \
	&& npm --silent test
done

#!/bin/bash
set -euo pipefail

### Options for mounting config dir from cluster
CONFIG=${1:-}

if [[ ! -z "$CONFIG" ]]; then
  export NODE_ENV=$CONFIG
  CONFIG="-b $TELEPRESENCE_ROOT/houston/config:$(pwd)/config"
fi

### Run proot to mount secrets, config, and any other volumes
proot \
  -b $TELEPRESENCE_ROOT/usr/local/share/ca-certificates/:/usr/local/share/ca-certificates/ \
  -b $TELEPRESENCE_ROOT/etc/houston:/etc/houston \
  $CONFIG \
  bash

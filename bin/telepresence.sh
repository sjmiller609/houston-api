#!/bin/bash
set -euo pipefail

PREFIX=${1}

telepresence \
  --namespace $PREFIX \
  --swap-deployment $PREFIX-houston \
  --run-shell

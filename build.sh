#!/bin/sh
# Monta o app: sh build.sh (site) ou sh build.sh artifact (artefato)
cd "$(dirname "$0")" && python3 build.py "$@"

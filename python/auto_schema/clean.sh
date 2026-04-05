#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

rm -rf \
  "${root}/dist" \
  "${root}/build" \
  "${root}/auto_schema.egg-info" \
  "${root}/auto_schema_test.egg-info"

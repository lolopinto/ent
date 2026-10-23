#!/bin/sh
# Check the installed Node runtime against the selected major's security floor.
set -eu

major="${1:?expected Node major}"
minimum="${2:-}"
case "$major" in
  22) minimum="${minimum:-22.23.4}" ;;
  24) minimum="${minimum:-24.22.1}" ;;
  *) echo "unsupported Node.js major version: $major" >&2; exit 1 ;;
esac

actual="$(node -p 'process.versions.node')"
if [ "${actual%%.*}" != "$major" ] || ! dpkg --compare-versions "$actual" ge "$minimum"; then
  echo "Node.js $actual does not satisfy major $major with minimum $minimum" >&2
  exit 1
fi

#!/usr/bin/env bash
# Checks every workflow in .github/workflows with actionlint (expressions, job
# wiring, and each run: script through shellcheck, which GitHub's Ubuntu runners
# ship). Pinned version + checksum: only GitHub-owned actions are allowed here, so
# the tool is fetched directly. To update, take the version and the
# linux_amd64.tar.gz line from https://github.com/rhysd/actionlint/releases.
#   bash scripts/actionlint.sh
set -euo pipefail
VERSION=1.7.12
SHA256=8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8

dir=$(mktemp -d)
tgz="$dir/actionlint.tar.gz"
curl -sSfL -o "$tgz" \
  "https://github.com/rhysd/actionlint/releases/download/v$VERSION/actionlint_${VERSION}_linux_amd64.tar.gz"
echo "$SHA256  $tgz" | sha256sum -c --quiet
tar -xzf "$tgz" -C "$dir" actionlint
"$dir/actionlint" -color

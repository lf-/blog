#!/bin/bash

set -euo pipefail

print_error() {
cat >&2 <<-EOF
Please create a .deploy_config with content:
PREVIEW_HOST=[the host you rsync to]
PREVIEW_DIR=some-subdomain
PREVIEW=https://blah
EOF
}

if [[ ! -e .deploy_config ]]; then
    print_error
    exit 1
fi

source ./.deploy_config

if [[ -z "${PREVIEW_HOST:-}" || -z "${PREVIEW_DIR:-}" || -z "${PREVIEW:-}" ]]; then
    print_error
    exit 1
fi

PREVIEW_TEMP=/tmp/zola-preview

rm -rf "$PREVIEW_TEMP"
../zola/target/debug/zola build --drafts --base-url "$PREVIEW" --output-dir "$PREVIEW_TEMP"

# trailing slash: copy contents of directory into destination
rsync --verbose --human-readable --recursive \
    --links --times --new-compress --delete-delay \
    --exclude-from=$HOME/.config/git/ignore \
    ${EXTRA_OPTS_PREVIEW:-} "$PREVIEW_TEMP/" "${PREVIEW_HOST}:${PREVIEW_DIR}"

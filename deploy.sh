#!/bin/bash

if [[ ! -e .deploy_config ]]; then
	cat >&2 <<-EOF
	Please create a .deploy_config with content:
	DEPLOY_HOST=[the host you rsync to]
	DEPLOY_DIR=[the directory you rsync to]
	# optional
	EXTRA_OPTS=[extra rsync options you want to use]
	EOF

	exit 1
fi

source .deploy_config
# trailing slash: copy contents of directory into destination
rsync --verbose --human-readable --recursive --links --times --compress --delete-delay ${EXTRA_OPTS} public/ "${DEPLOY_HOST}:${DEPLOY_DIR}"

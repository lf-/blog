#!/bin/bash

dim=$'\e[2m'
red=$'\e[31m'
norm=$'\e[0m'

# check if there are any untracked/not committed/etc files in the
# local repo first (fastest to check fail case)

if [[ -n "$(git status --porcelain)" ]]; then
    echo "${red}!! Local repo has changes that are not checked in${norm}" >&2
    git status -u
    exit 1
fi

# check if the remote git repo is different from the local clone
# this calls out to the network but that is acceptable in this context
# since you cannot deploy without network access

# source: https://stackoverflow.com/a/17938274
git fetch
if [[ ! $(git rev-parse HEAD) == $(git rev-parse @{u}) ]]; then
    echo "${red}!! Local repo does NOT match remote${norm}" >&2
    git status -u
    exit 1
else
    echo "${dim}:: Local repo matches remote${norm}" >&2
    exit 0
fi

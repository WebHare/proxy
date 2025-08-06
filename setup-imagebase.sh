#!/bin/bash

# Fail on any error
set -eo pipefail

# From https://github.com/moby/buildkit/blob/master/frontend/dockerfile/docs/experimental.md#example-cache-apt-packages
rm -f /etc/apt/apt.conf.d/docker-clean
echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' > /etc/apt/apt.conf.d/keep-cache

( curl -sL https://deb.nodesource.com/setup_20.x | bash - )

apt-get update
apt-get install -y software-properties-common curl gnupg2

apt-key adv --recv-keys --keyserver hkp://keyserver.ubuntu.com:80 7FCC7D46ACCC4CF8 #Postgres key

add-apt-repository 'deb http://apt-archive.postgresql.org/pub/repos/apt/ focal-pgdg main'

# in-container debugging: jq tcpdump
# envsubst: gettext-base
apt-get install -y certbot jq tcpdump nginx-full nodejs postgresql-15 tzdata git

# add typescript
npm install -g typescript eslint ts-node @swc/core

# Cleanup (?)
apt-get -qy autoremove

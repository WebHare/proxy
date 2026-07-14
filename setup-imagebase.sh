#!/bin/bash

# Fail on any error
set -eo pipefail

# @webhare: this is based on our serververmanagent project baseimage
dnf -y install epel-release curl logrotate cronie less gettext-envsubst man procps-ng iproute iputils telnet bind-utils tcpdump net-tools stunnel nginx hostname openssl
rpm --import https://rpm.nodesource.com/gpgkey/ns-operations-public.key
cat >/etc/yum.repos.d/nodesource-nodejs.repo <<'EOF'
[nodesource-nodejs]
name=NodeSource Node.js Packages
baseurl=https://rpm.nodesource.com/pub_26.x/nodistro/nodejs/$basearch
enabled=1
gpgcheck=1
gpgkey=https://rpm.nodesource.com/gpgkey/ns-operations-public.key
module_hotfixes=1
EOF
dnf -y install nodejs busybox certbot
dnf clean all

ln -s /usr/sbin/busybox /usr/sbin/sv
ln -s /usr/sbin/busybox /usr/sbin/runsv
ln -s /usr/sbin/busybox /usr/sbin/runsvdir
ln -s /opt/container/services/ /var/service



# # From https://github.com/moby/buildkit/blob/master/frontend/dockerfile/docs/experimental.md#example-cache-apt-packages
# rm -f /etc/apt/apt.conf.d/docker-clean
# echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' > /etc/apt/apt.conf.d/keep-cache

# ( curl -sL https://deb.nodesource.com/setup_20.x | bash - )

# apt-get update
# apt-get install -y software-properties-common curl gnupg2

# apt-key adv --recv-keys --keyserver hkp://keyserver.ubuntu.com:80 7FCC7D46ACCC4CF8 #Postgres key

# add-apt-repository 'deb http://apt-archive.postgresql.org/pub/repos/apt/ focal-pgdg main'

# # in-container debugging: jq tcpdump
# # envsubst: gettext-base
# apt-get install -y certbot jq tcpdump nginx-full nodejs postgresql-15 tzdata git

# # add typescript
# npm install -g typescript eslint ts-node @swc/core

# # Cleanup (?)
# apt-get -qy autoremove

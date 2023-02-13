#!/bin/bash
# this script is intended to be 'source'd

die() { echo "$@"; exit 1; }

WEBHAREPROXY_FSROOT="${BASH_SOURCE%/*/*/*}/"
[ -n "$WEBHAREPROXY_DATAROOT" ] || die WEBHAREPROXY_DATAROOT must be set

# Ensure it ends with a slash
[ "${WEBHAREPROXY_DATAROOT: -1}" == "/" ] || WEBHAREPROXY_DATAROOT="${WEBHAREPROXY_DATAROOT}/"

if [ -z "$WEBHAREPROXY_PGCONFIGFILE" ]; then
  if [ -n "$WEBHAREPROXY_IN_DOCKER" ]; then
    WEBHAREPROXY_PGCONFIGFILE="${WEBHAREPROXY_FSROOT}etc/postgresql-docker.conf"
  else
    WEBHAREPROXY_PGCONFIGFILE="${WEBHAREPROXY_FSROOT}etc/postgresql-sourceinstall.conf"
  fi
fi

if [ -z "$WEBHAREPROXY_CODEROOT" ]; then
  if [ -f "${WEBHAREPROXY_FSROOT}opt/webhare-nginx-proxy/src/nginx-proxy.js" ]; then
    WEBHAREPROXY_CODEROOT="${WEBHAREPROXY_FSROOT}opt/webhare-nginx-proxy/src/"
  elif [ -f "${WEBHAREPROXY_FSROOT%/*/*}/src/nginx-proxy.js" ]; then
    WEBHAREPROXY_CODEROOT="${WEBHAREPROXY_FSROOT%/*/*}/src/"
  else
    die Cannot find webhare proxy server code
  fi
fi

export WEBHAREPROXY_CODEROOT WEBHAREPROXY_FSROOT WEBHAREPROXY_DATAROOT

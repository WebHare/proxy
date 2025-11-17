#!/bin/bash

if [ ! -f "${WEBHAREPROXY_DATAROOT}etc/nginx.conf" ]; then
  echo "reload requested but configuration does not exist yet"
  exit 0
fi
if [ ! -f "${WEBHAREPROXY_DATAROOT}var/nginx.pid" ]; then
  echo "reload requested but nginx not running yet"
  exit 0
fi

if ! "${WEBHAREPROXY_NGINX}" -c "${WEBHAREPROXY_DATAROOT}etc/nginx.conf" -t ; then
  echo "CONFIG INCORRECT!"
  exit 1
fi

# Reset emergency log file
mv "${WEBHAREPROXY_DATAROOT}/log/emerg.log" "${WEBHAREPROXY_DATAROOT}/log/emerg.log-previous" 2>/dev/null

# flush the authcache as it's convenient SV reconfigure <server> just fixes stuff
rm -rf "${WEBHAREPROXY_DATAROOT}cache/authcache"/*
"${WEBHAREPROXY_NGINX}" -c "${WEBHAREPROXY_DATAROOT}etc/nginx.conf" -s reload >/dev/null 2>&1

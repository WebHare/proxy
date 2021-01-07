#!/bin/bash

if [ ! -f /opt/webhare-proxy-data/etc/nginx.conf ]; then
  echo "reload requested but configuration does not exist yet"
  exit 0
fi
if [ ! -f /var/run/nginx.pid ]; then
  echo "reload requested but nginx not running yet"
  exit 0
fi


if ! nginx -c /opt/webhare-proxy-data/etc/nginx.conf -t ; then
  echo "CONFIG INCORRECT!"
  exit 1
fi

# flush the authcache as it's convenient SV reconfigure <server> just fixes stuff
rm -rf /opt/webhare-proxy-data/cache/authcache/*
nginx -s reload >/dev/null 2>&1

#!/bin/bash

if ! nginx -c /opt/webhare-proxy-data/etc/nginx.conf -t ; then
  echo "CONFIG INCORRECT!"
  exit 1
fi

# flush the authcache as it's convenient SV reconfigure <server> just fixes stuff
rm -rf /opt/webhare-proxy-data/cache/authcache/*
nginx -s reload

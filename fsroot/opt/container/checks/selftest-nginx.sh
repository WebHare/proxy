#!/bin/bash
ERRORCODE=0

# Find emergency log errors
EMERGENCY="$(cat /data/log/emerg.log 2>/dev/null | tail -n 1)"

if [ -n "$EMERGENCY" ]; then
  echo "$EMERGENCY"
  ERRORCODE=1
fi

# Test whether nginx configuration is not in a broken state
if ! nginx -c /opt/webhare-proxy-data/etc/nginx.conf -t ; then
  echo "nginx configuration is broken"
  ERRORCODE=1
fi

exit $ERRORCODE

#!/bin/bash
if [ "$1" == "access" ]; then
  exec tail -f /opt/webhare-proxy-data/log/access.log
fi
exec tail -f /opt/webhare-proxy-data/log/error.log

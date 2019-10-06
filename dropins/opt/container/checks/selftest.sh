#!/bin/bash

# Test whether nginx configuration is not in a broken state
nginx -c /opt/webhare-proxy-data/etc/nginx.conf -t || exit 1
exit 0

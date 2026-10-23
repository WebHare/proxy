#!/bin/bash
# We are invoked by both the image definition and by proxy runlocal
# use WEBHAREPROXY_FSROOT as base path

cd "${WEBHAREPROXY_FSROOT}opt/webhare-nginx-proxy/" || exit 1
npm install
npm run build:admin

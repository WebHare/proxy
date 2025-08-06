#!/bin/bash
mkdir -p /opt/webhare-proxy-data/etc/ssl_config
mkdir -p /opt/webhare-proxy-data/etc/nginx-http /opt/webhare-proxy-data/{var,log,cache}
chown www-data /opt/webhare-proxy-data/cache/
mkdir -p /var/log/nginx/

if [ -n "$WEBHAREPROXY_ADMINHOSTNAME" ] && [ -n "$WEBHAREPROXY_LETSENCRYPTEMAIL" ] && [ ! -d /etc/letsencrypt/live/$WEBHAREPROXY_ADMINHOSTNAME ]; then
  /opt/container/try-adminhost-certbot.sh & disown
fi

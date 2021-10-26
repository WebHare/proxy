#!/bin/bash
if [ -z "$WEBHAREPROXY_ADMINHOSTNAME" ]; then
  echo WEBHAREPROXY_ADMINHOSTNAME not set
  exit 1
fi

if [ -z "$WEBHAREPROXY_LETSENCRYPTEMAIL" ]; then
  echo WEBHAREPROXY_LETSENCRYPTEMAIL not set
  exit 1
fi

if [ -d /etc/letsencrypt/live/$WEBHAREPROXY_ADMINHOSTNAME ]; then
  echo /etc/letsencrypt/live/$WEBHAREPROXY_ADMINHOSTNAME already exists
  exit 1
fi

certbot certonly -n --webroot -w /opt/adminhost/web -d "$WEBHAREPROXY_ADMINHOSTNAME" --agree-tos --email $WEBHAREPROXY_CERTBOT_OPTIONS "$WEBHAREPROXY_LETSENCRYPTEMAIL"
sv restart configserver

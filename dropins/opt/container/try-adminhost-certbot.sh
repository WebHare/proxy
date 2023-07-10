#!/bin/bash

echo -e "\n[try-adminhost-certbot] Waiting for $WEBHAREPROXY_ADMINHOSTNAME to come online\n"

CONNECTED=
for i in $(seq 1 10); do
  if ( curl -s http://$WEBHAREPROXY_ADMINHOSTNAME/ | grep --silent "adminhost" ); then
    CONNECTED=1
    break;
  fi
  echo -n "."
  sleep 1
done

if [ -z "$CONNECTED" ]; then
  echo ""
  echo "[try-adminhost-certbot] Failed to connect. Sleeping for 1 hour and then retrying (this is normal when running locally)"
  sleep 3600
  exec $0
  exit 1
fi

echo -e "\n[try-adminhost-certbot] PROXY IS ONLINE!\n"
/opt/container/setup-adminhost-certbot.sh

if [ ! -d /etc/letsencrypt/live/$WEBHAREPROXY_ADMINHOSTNAME ] ; then
  echo -e "\n[try-adminhost-certbot] No keyfile found, will retry in an hour\n"
  sleep 3600
  exec $0
  exit 1
fi

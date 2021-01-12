#!/bin/bash
mkdir -p /opt/webhare-proxy-data/var/logrotate
mkdir -p /opt/webhare-proxy-data/log
mkdir -p /opt/webhare-proxy-data/letsencrypt/{etc,lib,log}
chown -R root.root /opt/webhare-proxy-data/log # to make sure logrotate doesn't freak out about the permissions

if [ -n "$WEBHAREPROXY_ADMINHOSTNAME" -a -n "$WEBHAREPROXY_LETSENCRYPTEMAIL" -a ! -d /etc/letsencrypt/live/$WEBHAREPROXY_ADMINHOSTNAME ]; then
  /opt/container/try-adminhost-certbot.sh & disown
fi

exec /sbin/my_init

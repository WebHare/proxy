#!/bin/bash
mkdir -p /opt/webhare-proxy-data/var/logrotate
mkdir -p /opt/webhare-proxy-data/log
mkdir -p /opt/webhare-proxy-data/letsencrypt/{etc,lib,log}
chown -R root.root /opt/webhare-proxy-data/log # to make sure logrotate doesn't freak out about the permissions

if [ -n "$WEBHAREPROXY_ADMINHOSTNAME" -a -n "$WEBHAREPROXY_LETSENCRYPTEMAIL" -a ! -d /etc/letsencrypt/live/$WEBHAREPROXY_ADMINHOSTNAME ]; then
  /opt/container/try-adminhost-certbot.sh & disown
fi

# If runsvdir receives a HUP signal, it sends a TERM signal to each runsv(8) process it is monitoring and then exits with 111.
/usr/bin/runsvdir /etc/runit/runsvdir/default/ &
RUNSVDIR_PID=$!

function shutdown()
{
  kill -HUP $RUNSVDIR_PID
  exit 0
}

trap shutdown TERM INT
wait $RUNSVDIR_PID

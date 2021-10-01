#!/bin/bash
mkdir -p /opt/webhare-proxy-data/var/logrotate
mkdir -p /opt/webhare-proxy-data/etc/ssl_config
mkdir -p /opt/webhare-proxy-data/log
mkdir -p /opt/webhare-proxy-data/letsencrypt/{etc,lib,log}
chown -R root.root /opt/webhare-proxy-data/log # to make sure logrotate doesn't freak out about the permissions

mkdir -p /opt/webhare-proxy-data/etc/nginx-http /opt/webhare-proxy-data/{var,log,cache}
chown www-data /opt/webhare-proxy-data/cache/

mkdir -p /opt/webhare-proxy-data/etc/ssl_config

ensurekey()
{
  local BASENAME BASEPATH HOSTNAME

  BASENAME="$1"
  BASEPATH=/opt/webhare-proxy-data/etc/ssl_config/${BASENAME}
  HOSTNAME="$2"

  if [ ! -f "${BASEPATH}.key" ] && [ ! -f  "${BASEPATH}.crt" ]; then
    echo "*** 50_setup_nginx_proxy.sh: Generating certificate for $HOSTNAME"
    mv "${BASEPATH}".key{,.bak} 2>/dev/null #ignore errors,just a backup
    mv "${BASEPATH}".crt{,.bak} 2>/dev/null

    cd /opt/webhare-proxy-data/etc/ssl_config || exit 1
    openssl genrsa -out "${BASENAME}.key" 2048
    echo -e "NL\nOverijssel\nEnschede\nWebHare\n\n$(hostname -f)\n" | openssl req -new -x509 -nodes -sha1 -days 365 -key "${BASENAME}.key" 2>/dev/null > "${BASENAME}.crt"
  fi
}

ensurekey ssl "$(hostname -f)"
# Do the WEBHAREPROXY_ADMINHOSTNAME keys exist?
if [ -n "$WEBHAREPROXY_ADMINHOSTNAME" ]; then
  ensurekey "${WEBHAREPROXY_ADMINHOSTNAME}" "${WEBHAREPROXY_ADMINHOSTNAME}"
fi

if [ ! -f /opt/webhare-proxy-data/etc/nginx.conf ]; then
  echo "** Creating initial configuration"
  /opt/webhare-nginx-proxy/src/nginx-proxy.js --resetconfig
fi


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

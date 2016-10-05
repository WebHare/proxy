#!/bin/sh
mkdir -p /opt/webhare-proxy-data/{etc,etc/nginx-http/var,log}

if [ ! -f /opt/webhare-proxy-data/etc/webhare-proxy-dhparam.pem ]; then
  openssl dhparam -out /opt/webhare-proxy-data/etc/webhare-proxy-dhparam.pem 2048
fi

if [ ! -f /opt/webhare-proxy-data/etc/nginx.conf ]; then
  echo "** Creating initial configuration"
  /opt/webhare-nginx-proxy/src/nginx-proxy.js --resetconfig
fi

if [ ! -f /opt/webhare-proxy-data/etc/ssl_config/ssl.crt ]; then
  mkdir /opt/webhare-proxy-data/etc/ssl_config
  cd /opt/webhare-proxy-data/etc/ssl_config
  openssl genrsa -out ssl.key 2048
  echo -e "NL\nOverijssel\nEnschede\nWebHare\n\n`hostname -f`\n" | openssl req -new -x509 -nodes -sha1 -days 365 -key ssl.key > ssl.crt
fi

exec /usr/bin/supervisord -c /etc/supervisord.conf

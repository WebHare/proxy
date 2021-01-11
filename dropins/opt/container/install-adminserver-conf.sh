#!/bin/sh

if [ -z "$1" ]; then
  echo Error: missing file name
  echo "Syntax: /opt/container/install-adminserver-conf.sh <file-base-name>"
  echo "Provide configuration file contents via STDIN"
  exit 1
fi

FILENAME="/opt/webhare-proxy-data/etc/nginx-adminserver/$1.conf"
cat > "$FILENAME"

if [ ! -s "$FILENAME" ]; then
  echo "No input, removing file $1.conf"
  rm "$FILENAME"
else
  echo "Testing new configuration file"
  if ! /usr/sbin/nginx -t -c /opt/webhare-proxy-data/etc/nginx.conf; then
    echo "Configuration test failed, configuration file $1.conf has been removed"
    rm "$FILENAME"
    exit 1
  fi
fi

echo "Reloading"
/opt/container/reload.sh

echo "Installation complete"

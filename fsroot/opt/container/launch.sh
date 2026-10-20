#!/bin/bash

# Ensure data folders are in place
mkdir -p /data/log /data/state/logrotate

# Reroute logs
# Move logrotate state into container state
rm -rf /var/log
ln -s /data/log /var/log

rm -rf /var/lib/logrotate
ln -sf /data/state/logrotate /var/lib/logrotate

# fix permissions on logrotate/cron to make sure cron/logrotate trusts them
chown root /etc/logrotate.conf /etc/logrotate.d/*.conf /etc/cron.d/* /etc/cron/ /etc/crontab 2>/dev/null
chmod 644 /etc/logrotate.conf /etc/logrotate.d/*.conf /etc/cron.d/* /etc/cron/ /etc/crontab 2>/dev/null
chown -R root:root /data/log

# touch a marker to allow us to test later if cron is up
touch /root/.hourly-cron-test-file

if which letsencrypt >/dev/null 2>&1 ; then
  # Move letsencrypt data folders to permanent storage
  rm -rf /etc/letsencrypt /var/lib/letsencrypt /var/log/letsencrypt/
  ln -sf /data/letsencrypt/etc /etc/letsencrypt
  ln -sf /data/letsencrypt/lib /var/lib/letsencrypt
  mkdir -p /data/letsencrypt/{etc,lib,log}
fi

# This script ensures proper signal handling to do a proper shutdown when docker tells us to
# and bash itself should be a proper zombie reaper

# If runsvdir receives a HUP signal, it sends a TERM signal to each runsv(8) process it is monitoring and then exits with 111.
echo "Starting services" 1>&2
runsvdir /opt/container/services/ &
RUNSVDIR_PID=$!

function shutdown()
{
  echo "Shutdown signal received" 1>&2
  kill -HUP $RUNSVDIR_PID
  exit 0
}

trap shutdown TERM INT
wait $RUNSVDIR_PID

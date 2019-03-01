#!/bin/bash
mkdir -p /opt/webhare-proxy-data/var/logrotate
mkdir -p /opt/webhare-proxy-data/letsencrypt/{etc,lib,log}
chown -R root.root /opt/webhare-proxy-data/log # to make sure logrotate doesn't freak out about the permissions

exec /sbin/my_init

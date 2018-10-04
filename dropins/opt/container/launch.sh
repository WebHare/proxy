#!/bin/bash
mkdir -p /opt/webhare-proxy-data/var/logrotate
mkdir -p /opt/webhare-proxy-data/letsencrypt/{etc,lib,log}

exec /sbin/my_init

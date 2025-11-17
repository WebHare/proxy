#!/bin/bash
WARN=

TESTFILEAGE="$(( $(date +%s) - $(stat -L --format %Y /root/.hourly-cron-test-file) ))"
if [ -z "$TESTFILEAGE" ] || (( TESTFILEAGE > 70*60 )); then
  WARN=1
  echo "crontab doesn't appear to be running properly, /root/.hourly-cron-test-file is over $(( TESTFILEAGE / 60 )) minutes old"
fi

[ -n "$WARN" ] && exit 1
exit 0

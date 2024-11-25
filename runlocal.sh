#!/bin/bash
set -eo pipefail

WEBHAREPROXY_CODEROOT="$(cd "${BASH_SOURCE%/*}"; pwd)/"

if [ -x /opt/homebrew/bin/nginx ]; then
  WEBHAREPROXY_NGINX=/opt/homebrew/bin/nginx
elif [ -x /usr/local/bin/nginx ]; then
  WEBHAREPROXY_NGINX=/usr/local/bin/nginx
else
  echo "NGINX not found"
  exit 1
fi

export WEBHAREPROXY_FSROOT="${WEBHAREPROXY_CODEROOT}dropins/"
export WEBHAREPROXY_DATAROOT="${WEBHAREPROXY_CODEROOT}localdata/"
export WEBHAREPROXY_PORT_HTTP=80
export WEBHAREPROXY_PORT_HTTPS=443
export WEBHAREPROXY_MGMT_HTTP=5080
export WEBHAREPROXY_MGMT_HTTPS=5443

export WEBHAREPROXY_CODEROOT WEBHAREPROXY_NGINX

echo "Data root: $WEBHAREPROXY_DATAROOT"

# TODO dynamic brew configuration, see chatplane? or webhare' rb
if ! hash runsv ; then
  echo "install runsv (brew install runit)"
  exit 1
fi

set -m
{
  trap '' INT TERM HUP
  runsvdir -P "$WEBHAREPROXY_CODEROOT/dropins/opt/container/services"
} &
set +m

RUNSVDIR_PID="$!"
echo PID $RUNSVDIR_PID

terminate() {
  echo "Sending TERM" to $RUNSVDIR_PID
  ps ax|grep $$RUNSVDIR_PID
  kill -TERM $RUNSVDIR_PID

  pkill runsv runsvdir # force them to stop. FIXME avoid this, but it seems runsvdir doesn't always stop the runsv's - it appeasr to just go await itself once it receives a SIGINT
  wait $RUNSVDIR_PID
}

trap terminate EXIT INT TERM HUP

wait $RUNSVDIR_PID

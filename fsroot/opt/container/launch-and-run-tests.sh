#!/bin/bash

# launch the container in the background...
/opt/container/launch.sh &

# run tests!

# Verify code first
if ! "${WEBHAREPROXY_FSROOT}opt/webhare-nginx-proxy/node_modules/.bin/tsc" --project "${BASH_SOURCE%/*}/opt/webhare-nginx-proxy/src/tsconfig.json" ; then
  echo "TypeScript compilation failed"
  exit 1
fi

for i in $( seq 1 10 ); do
  ADMINKEY=$(/opt/container/get-proxy-key.sh)
  if [ -n "$ADMINKEY" ] ; then
    break
  fi

  echo "Waiting for admin key (${i}/10)..."
  sleep .5
done

if [ -z "$ADMINKEY" ]; then
  echo "Unable to get the admin key"
  exit 1
fi

exit 0

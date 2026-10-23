#!/bin/bash

set -eo pipefail

if [ -z "$TEST_PROXY_IMAGE" ]; then
  TEST_PROXY_IMAGE="webhare/proxy:devbuild"
fi

CONTAINERNAME="testproxy$RANDOM"

if ! podman run -l webharecitype=testcontainer --rm -i --name "$CONTAINERNAME" \
  -e WEBHAREPROXY_CERTBOT_OPTIONS=--staging \
  "$TEST_PROXY_IMAGE" \
  /opt/container/launch-and-run-tests.sh ; then
    echo 'TESTS FAILED!'
    exit 1
fi

function cleanup()
{
  podman rm --force "$CONTAINERNAME" 2> /dev/null
  podman rm --force "$CONTAINERNAME-testscript" 2> /dev/null
}

trap cleanup EXIT


cleanup
if ! podman create -l webharecitype=testcontainer --rm --name "$CONTAINERNAME" -e WEBHAREPROXY_CERTBOT_OPTIONS=--staging -e WEBHAREPROXY_ADMINHOSTNAME=admin.example.com "$TEST_PROXY_IMAGE"; then
  echo "Test failed"
  exit 1
fi

podman start "$CONTAINERNAME"
podman logs -f "$CONTAINERNAME" &

PROXYIP=$(podman inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$CONTAINERNAME")
export PROXYIP
if [[ $OSTYPE == 'darwin'* ]]; then
  # macOS Podman runs containers in a VM, so the gateway address is seen as the remote IP.
  EXPECTSEENCONNECTIP=$(podman inspect -f '{{range.NetworkSettings.Networks}}{{.Gateway}}{{end}}' "$CONTAINERNAME")
  export EXPECTSEENCONNECTIP
fi

export PROXYKEY;
for _ in {1..60}; do
  PROXYKEY=$(podman exec "$CONTAINERNAME" /root/get-proxy-key.sh || true)
  if [ -n "$PROXYKEY" ]; then
    break
  fi
  sleep 1
done

if [ -z "$PROXYKEY" ]; then
  echo "Could not retrieve proxy key"
fi

# Create a Node.js container to run the test script
if ! podman create --rm -w /tests --name "$CONTAINERNAME-testscript" \
    -e PROXYIP="$PROXYIP" \
    -e PROXYKEY="$PROXYKEY" \
    node /tests/runtest.sh ; then
  echo "Setup node runner failed"
  exit 1
fi

TESTDIR=${BASH_SOURCE%/*}/tests/
# Copy the tests directory to the container, mounts are too impossible in a DIND scenario
if ! podman cp "$TESTDIR/" "$CONTAINERNAME-testscript:/"; then
  echo "Copy failed"
  exit 1
fi

echo "** running testscript"
podman start "$CONTAINERNAME-testscript"
podman logs -f "$CONTAINERNAME" &
podman wait "$CONTAINERNAME-testscript"
echo "** all tests succeeded"

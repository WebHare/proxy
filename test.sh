#!/bin/bash

if [ -z "$TEST_PROXY_IMAGE" ]; then
  TEST_PROXY_IMAGE="webhare/proxy:devbuild"
fi

DOCKERBASENAME="testproxy$RANDOM"

if ! docker run -l webharecitype=testdocker --rm -i --name "$DOCKERBASENAME" \
  -e WEBHAREPROXY_CERTBOT_OPTIONS=--staging \
  "$TEST_PROXY_IMAGE" \
  /opt/container/launch-and-run-tests.sh ; then
    echo 'TESTS FAILED!'
    exit 1
fi

function cleanup()
{
  docker rm --force $DOCKERBASENAME 2> /dev/null
  docker rm --force "$DOCKERBASENAME-testscript" 2> /dev/null
}

trap cleanup EXIT


cleanup
if ! docker create -l webharecitype=testdocker --rm --name $DOCKERBASENAME -e WEBHAREPROXY_CERTBOT_OPTIONS=--staging -e WEBHAREPROXY_ADMINHOSTNAME=admin.example.com "$TEST_PROXY_IMAGE"; then
  echo "Test failed"
  exit 1
fi

docker start $DOCKERBASENAME
docker logs -f $DOCKERBASENAME &

PROXYIP=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $DOCKERBASENAME)
export PROXYIP
if [[ $OSTYPE == 'darwin'* ]]; then
  # mac Docker Desktop can't directly route to docker containers, it sees the gateway ip addr as remote IP
  EXPECTSEENCONNECTIP=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.Gateway}}{{end}}' $DOCKERBASENAME)
  export EXPECTSEENCONNECTIP
fi

export PROXYKEY;
for _ in {1..60}; do
  PROXYKEY=$(docker exec $DOCKERBASENAME /root/get-proxy-key.sh)
  if [ -n "$PROXYKEY" ]; then
    break
  fi
  sleep 1
done

if [ -z "$PROXYKEY" ]; then
  echo "Could not retrieve proxy key"
fi

# Create a node docker to run the data
if ! docker create --rm -w /tests --name "$DOCKERBASENAME-testscript" \
    -e PROXYIP="$PROXYIP" \
    -e PROXYKEY="$PROXYKEY" \
    node /tests/runtest.sh ; then
  echo "Setup node runner failed"
  exit 1
fi

TESTDIR=${BASH_SOURCE%/*}/tests/
# Copy the tests directory to the container, mounts are too impossible in a DIND scenario
if ! docker cp "$TESTDIR/" "$DOCKERBASENAME-testscript:/"; then
  echo "Copy failed"
  exit 1
fi

echo "** running testscript"
if ! docker start -a "$DOCKERBASENAME-testscript"; then
  echo "Test failed"
  exit 1
fi

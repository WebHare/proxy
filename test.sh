#!/bin/sh

if [ -z "$TEST_PROXY_IMAGE" ]; then
  TEST_PROXY_IMAGE=webhare/proxy:devbuild
fi

if ! docker run -l webharecitype=testdocker --rm -i --name testproxy \
  -e WEBHAREPROXY_CERTBOT_OPTIONS=--staging \
  $TEST_PROXY_IMAGE \
  /opt/container/launch-and-run-tests.sh ; then
    echo 'TESTS FAILED!'
    exit 1
fi

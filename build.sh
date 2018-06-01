#!/bin/bash
cd ${BASH_SOURCE%/*}

# WebHare/SV integration

export TAG="gitlab-registry.webhare.com/webhare/nginx-proxy:devbuild"
if ! ./docker.sh build ; then
  echo Build failed
  exit
fi

if [ "$1" == "--push" ]; then
  docker push $TAG
  echo Pushed: $TAG
fi

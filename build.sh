#!/bin/bash
cd ${BASH_SOURCE%/*}

# WebHare/SV integration

export TAG="gitlab-registry.webhare.com/webhare/proxy:devbuild"
if ! ./docker.sh build ; then
  echo Build failed
  exit
fi

if [ "$1" == "--push" ]; then
  docker push $TAG
  echo Pushed: $TAG
fi

if [ "$1" == "--push-if-pushed" ]; then
  if [ "$CI_PIPELINE_SOURCE" == "push" ]; then
    push=1
  fi
  shift
fi

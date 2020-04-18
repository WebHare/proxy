#!/bin/bash
cd ${BASH_SOURCE%/*}

# WebHare/SV integration

export TAG="webhare/proxy:devbuild"
if ! ./docker.sh build ; then
  echo Build failed
  exit
fi

if [ "$1" == "--push" ]; then
  if ! docker push $TAG ; then
    echo Push failed for tag: $TAG
    echo You may need to login: docker login
    exit 1
  fi
  echo Pushed: $TAG
fi

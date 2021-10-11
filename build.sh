#!/bin/bash
cd "${BASH_SOURCE%/*}" || exit 1

cp -f .git/refs/heads/master dropins/opt/container/currentversion

# WebHare/SV integration

export TAG="webhare/proxy:devbuild"
if ! ./docker.sh build ; then
  echo Build failed
  exit 1
fi

if [ "$1" == "--push" ]; then
  if ! docker push $TAG ; then
    echo Push failed for tag: $TAG
    echo You may need to login: docker login
    exit 1
  fi
  echo Pushed: $TAG
fi

exit 0

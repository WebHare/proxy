#!/bin/sh
cd "${0%/*}" || exit 1

mkdir -p dropins/opt/container/etc
git rev-parse HEAD > dropins/opt/container/etc/proxy-version
git branch --show-current > dropins/opt/container/etc/proxy-branch

# WebHare/SV integration

if [ -n "$CI_COMMIT_REF_NAME" ]; then
  export TAG="webhare/proxy:$CI_COMMIT_REF_NAME"
else
  export TAG="webhare/proxy:devbuild"
fi

if ! ./docker.sh build ; then
  echo Build failed
  exit 1
fi

if [ "$1" = "--push" ]; then
  if ! docker push $TAG ; then
    echo Push failed for tag: $TAG
    echo You may need to login: docker login
    exit 1
  fi
  echo Pushed: $TAG
fi

exit 0

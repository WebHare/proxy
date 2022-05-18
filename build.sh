#!/bin/bash
cd "${0%/*}" || exit 1

mkdir -p dropins/opt/container/etc
git rev-parse HEAD > dropins/opt/container/etc/proxy-version
# CI checkouts break the actual branch reported by git, so in that case we take it from the vars
echo "${CI_COMMIT_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}" > dropins/opt/container/etc/proxy-branch

# WebHare/SV integration

if [ -n "$CI_COMMIT_REF_NAME" ]; then
  export TAG="webhare/proxy:${CI_COMMIT_TAG:-$CI_COMMIT_REF_SLUG}"
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

#!/bin/bash
cd "${0%/*}" || exit 1

USEPODMAN=""
DOCKERBUILDOPTS=()
PUSH=""

while [[ $1 =~ ^-.* ]]; do
  if [ "$1" == "--podman" ]; then
    USEPODMAN="1"
    DOCKERBUILDOPTS+=(--podman)
    shift
  elif [ "$1" == "--push" ]; then
    PUSH=1
    shift
  else
    echo "Illegal option $1"
    exit 1
  fi
done

RunBuilder()
{
  local retval
  if [ -z "$USEPODMAN" ]; then
    echo "$(date) docker" "$@" >&2
    docker "$@" ; retval="$?"
    if [ "$retval" != "0" ]; then
      echo "$(date) docker returned errorcode $retval" >&2
    fi
    return $retval
  else
    echo "$(date) podman" "$@" >&2
    podman "$@" ; retval="$?"
    if [ "$retval" != "0" ]; then
      echo "$(date) podman returned errorcode $retval" >&2
    fi
    return $retval
  fi
}

mkdir -p dropins/opt/container/etc
git rev-parse HEAD > dropins/opt/container/etc/proxy-version
# CI checkouts break the actual branch reported by git, so in that case we take it from the vars
echo "${CI_COMMIT_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}" > dropins/opt/container/etc/proxy-branch

# WebHare/SV integration

if [ -n "$CI_COMMIT_REF_NAME" ]; then
  export TAG="docker.io/webhare/proxy:${CI_COMMIT_TAG:-$CI_COMMIT_REF_SLUG}"
else
  export TAG="docker.io/webhare/proxy:devbuild"
fi

if ! ./docker.sh "${DOCKERBUILDOPTS[@]}" build; then
  echo Build failed
  exit 1
fi

if [ "$PUSH" == "1" ]; then
  if ! RunBuilder push $TAG ; then
    echo Push failed for tag: $TAG
    echo You may need to login: docker login
    exit 1
  fi
  echo Pushed: $TAG
fi

exit 0

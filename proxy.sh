#!/bin/bash
cd "${0%/*}" || exit 1

USEPODMAN=""
DOCKERBUILDOPTS=()
PUSH=""
CONTAINERNAME=testproxy
RUNBUILDER_PREFIX=""
NOPULL=

while [[ $1 =~ ^-.* ]]; do
  if [ "$1" == "--podman" ]; then
    USEPODMAN="1"
    DOCKERBUILDOPTS+=(--security-opt label=disable)
    shift
  elif [ "$1" == "--nopull" ]; then
    NOPULL="1"
    shift
  elif [ "$1" == "--push" ]; then
    PUSH=1
    shift
  else
    echo "Illegal option $1"
    exit 1
  fi
done

if [ -z "$NOPULL" ]; then
  if [ -n "$USEPODMAN" ]; then
    DOCKERBUILDOPTS+=(--pull newer)
  else
    DOCKERBUILDOPTS+=(--pull)
  fi
fi

RunBuilder()
{
  local retval
  if [ -z "$USEPODMAN" ]; then
    echo "$(date) docker" "$@" >&2
    $RUNBUILDER_PREFIX docker "$@" ; retval="$?"
    if [ "$retval" != "0" ]; then
      echo "$(date) docker returned errorcode $retval" >&2
    fi
    return $retval
  else
    echo "$(date) podman" "$@" >&2
    $RUNBUILDER_PREFIX podman "$@" ; retval="$?"
    if [ "$retval" != "0" ]; then
      echo "$(date) podman returned errorcode $retval" >&2
    fi
    return $retval
  fi
}

if [ -n "$CI_COMMIT_REF_NAME" ]; then
  export TAG="docker.io/webhare/proxy:${CI_COMMIT_TAG:-$CI_COMMIT_REF_SLUG}"
else
  export TAG="docker.io/webhare/proxy:devbuild"
fi

if [ "$1" == "build" ]; then
  mkdir -p dropins/opt/container/etc
  git rev-parse HEAD > dropins/opt/container/etc/proxy-version

  # CI checkouts break the actual branch reported by git, so in that case we take it from the vars
  echo "${CI_COMMIT_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}" > dropins/opt/container/etc/proxy-branch

  # WebHare/SV integration

  if [ -z "$CI_COMMIT_SHA" ]; then
    # Not a CI build, try to get git commit and branch
    # Also note that Runkit expects a com.webhare.webhare.git-commit-ref label to be present to recognize the image as a WebHare image
    # so this is the path used by Escrow builds to actually set this information
    CI_COMMIT_SHA="$(git rev-parse HEAD 2> /dev/null)"
    CI_COMMIT_REF_NAME="$(git rev-parse --abbrev-ref HEAD 2> /dev/null)"
    if [ -n "$CI_COMMIT_SHA$CI_COMMIT_REF_NAME" ]; then
      echo "Building from git, branch '$CI_COMMIT_REF_NAME', commit '$CI_COMMIT_SHA'"
    fi
  fi

  # Record CI information so we can verify eg. if this image really matches the most recent build
  DOCKERBUILDOPTS+=(--build-arg "CI_COMMIT_SHA=$CI_COMMIT_SHA")
  DOCKERBUILDOPTS+=(--build-arg "CI_COMMIT_REF_NAME=$CI_COMMIT_REF_NAME")
  DOCKERBUILDOPTS+=(--build-arg "CI_PIPELINE_ID=$CI_PIPELINE_ID")
  DOCKERBUILDOPTS+=(--build-arg "CI_COMMIT_TAG=$CI_COMMIT_TAG")
  DOCKERBUILDOPTS+=(--tag "$TAG")
  DOCKERBUILDOPTS+=(--progress plain)

  export DOCKER_BUILDKIT=1

  if ! RunBuilder build "${DOCKERBUILDOPTS[@]}" . ; then
    echo "Docker build failed"
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
fi

if [ "$1" = "shell" ]; then
  RUNBUILDER_PREFIX="exec" RunBuilder exec -ti $CONTAINERNAME /bin/bash
fi
if [ "$1" = "getproxykey" ]; then
  RUNBUILDER_PREFIX="exec" RunBuilder exec $CONTAINERNAME /opt/container/get-proxy-key.sh
fi

DOCKERARGS="-v $(pwd)/runtimedata:/opt/webhare-proxy-data/ -eWEBHAREPROXY_ADMINHOSTNAME=127.0.0.1 -p 41080:80 -p 41443:443 -p 45443:5443 --name $CONTAINERNAME"
DEVELOPRUNCMD="RunBuilder run -v $(pwd)/src:/opt/webhare-nginx-proxy/src $DOCKERARGS"
LIVERUNCMD="RunBuilder run $DOCKERARGS"

if [ "$1" = "shell" ]; then
  RUNBUILDER_PREFIX="exec" RunBuilder exec -ti $CONTAINERNAME /bin/bash
fi

if [ "$1" = "getproxykey" ]; then
  RUNBUILDER_PREFIX="exec" RunBuilder exec $CONTAINERNAME /opt/container/get-proxy-key.sh
fi

if [ "$1" = "run" ]; then
  RunBuilder kill $CONTAINERNAME
  RunBuilder rm $CONTAINERNAME
  RUNBUILDER_PREFIX=exec $DEVELOPRUNCMD -ti $TAG
fi

if [ "$1" = "runlive" ]; then
  RunBuilder kill $CONTAINERNAME
  RunBuilder rm $CONTAINERNAME
  RUNBUILDER_PREFIX=exec $LIVERUNCMD -ti $TAG
fi

if [ "$1" = "runshell" ]; then
  RunBuilder kill $CONTAINERNAME
  RunBuilder rm $CONTAINERNAME
  RUNBUILDER_PREFIX=exec $DEVELOPRUNCMD -ti $TAG /bin/bash
fi

cat << HERE
- shell:       Launch a shell in a running $CONTAINERNAME container
- getproxykey: Get key for the proxy
- build:       Just build
- run:         Build and run for development (mounts src/ into container)
- runshell:    Build for development, but run a shell instead of the supervisor
- runlive:     Build and run like live (no src/ mount)
HERE

exit 1

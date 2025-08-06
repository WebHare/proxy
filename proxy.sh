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
    if ! RunBuilder push "$TAG" ; then
      echo Push failed for tag: "$TAG"
      echo You may need to login: docker login
      exit 1
    fi
    echo Pushed: "$TAG"
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
  RUNBUILDER_PREFIX="exec" $DEVELOPRUNCMD -ti "$TAG"
fi

if [ "$1" = "runlive" ]; then
  RunBuilder kill $CONTAINERNAME
  RunBuilder rm $CONTAINERNAME
  RUNBUILDER_PREFIX="exec" $LIVERUNCMD -ti "$TAG"
fi

if [ "$1" = "runshell" ]; then
  RunBuilder kill $CONTAINERNAME
  RunBuilder rm $CONTAINERNAME
  RUNBUILDER_PREFIX="exec" $DEVELOPRUNCMD -ti "$TAG" /bin/bash
fi

if [ "$1" = "runlocal" ]; then
  WEBHAREPROXY_CODEROOT="$(cd "${BASH_SOURCE%/*}" || exit; pwd)/"

  if [ -x /opt/homebrew/bin/nginx ]; then
    WEBHAREPROXY_NGINX=/opt/homebrew/bin/nginx
  elif [ -x /usr/local/bin/nginx ]; then
    WEBHAREPROXY_NGINX=/usr/local/bin/nginx
  else
    echo "NGINX not found"
    exit 1
  fi

  export WEBHAREPROXY_FSROOT="${WEBHAREPROXY_CODEROOT}dropins/"
  export WEBHAREPROXY_DATAROOT="${WEBHAREPROXY_CODEROOT}localdata/"
  export WEBHAREPROXY_PORT_HTTP=80
  export WEBHAREPROXY_PORT_HTTPS=443
  export WEBHAREPROXY_MGMT_HTTP=5080
  export WEBHAREPROXY_MGMT_HTTPS=5443

  export WEBHAREPROXY_CODEROOT WEBHAREPROXY_NGINX

  echo "Data root: $WEBHAREPROXY_DATAROOT"

  # TODO dynamic brew configuration, see chatplane? or webhare' rb
  if ! hash runsv ; then
    echo "install runsv (brew install runit)"
    exit 1
  fi


  set -m
  {
    trap '' INT TERM HUP
    runsvdir -P "$WEBHAREPROXY_CODEROOT/dropins/opt/container/services"
  } &
  set +m

  RUNSVDIR_GROUP_PID="$!"
  echo PID $RUNSVDIR_GROUP_PID

  # shellcheck disable=SC2329
  terminate() {
    ps -p "$RUNSVDIR_GROUP_PID" > /dev/null || return 0

    echo "Sending TERM" to "$RUNSVDIR_GROUP_PID"

    # get the PID of the runsvdir process
    RUNSVDIR_PID=$(pgrep -P "$RUNSVDIR_GROUP_PID" runsvdir || false)

    # force the runsv(dir)s to stop. FIXME avoid this, but it seems runsvdir doesn't always stop the runsv's - it appears to just go await itself once it receives a SIGINT
    if [ -n "$RUNSVDIR_PID" ]; then
      # Send a HUP to the runsvdir process to kill the runsv processes
      kill -HUP "$RUNSVDIR_PID"
    fi
    kill "$RUNSVDIR_GROUP_PID"

    ps -p "$RUNSVDIR_GROUP_PID" > /dev/null && wait "$RUNSVDIR_GROUP_PID" || true
  }

  trap terminate EXIT INT TERM HUP

  wait "$RUNSVDIR_GROUP_PID"
  exit 0
fi

cat << HERE
- shell:       Launch a shell in a running $CONTAINERNAME container
- getproxykey: Get key for the proxy
- build:       Just build
- run:         Build and run for development (mounts src/ into container)
- runshell:    Build for development, but run a shell instead of the supervisor
- runlive:     Build and run like live (no src/ mount)
- runlocal:    Run locally from source
HERE

exit 1

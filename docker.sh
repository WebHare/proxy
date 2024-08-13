#!/bin/bash
cd "${0%/*}" || exit 1

USEPODMAN=""
BUILDOPTIONS=()
NOPULL=

while [[ $1 =~ ^-.* ]]; do
  if [ "$1" == "--podman" ]; then
    USEPODMAN="1"
    BUILDOPTIONS=(--security-opt label=disable)
    shift
  elif [ "$1" == "--nopull" ]; then
    NOPULL=1
    shift
  else
    echo "Illegal option $1"
    exit 1
  fi
done

[ -z "$NOPULL" ] && BUILDOPTIONS+=(--pull)

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

CONTAINERNAME=testproxy
if [ -z "$TAG" ]; then
  TAG=webhare/nginx-proxy:devbuild
fi

DOCKERARGS="-v $(pwd)/runtimedata:/opt/webhare-proxy-data/ -eWEBHAREPROXY_ADMINHOSTNAME=127.0.0.1 -p 41080:80 -p 41443:443 -p 45443:5443 --name $CONTAINERNAME"
if [ -n "$WEBHAREPROXY_BINDTO_IPV4" ]; then
  DOCKERARGS="$DOCKERARGS -e WEBHAREPROXY_BINDTO_IPV4=$WEBHAREPROXY_BINDTO_IPV4"
elif [ -n "$WEBHARE_PROXY_BINDTO_IPV4" ]; then # Legacy users
  DOCKERARGS="$DOCKERARGS -e WEBHAREPROXY_BINDTO_IPV4=$WEBHARE_PROXY_BINDTO_IPV4"
fi

export DOCKER_BUILDKIT=1
DEVELOPRUNCMD="RunBuilder run -v $(pwd)/src:/opt/webhare-nginx-proxy/src $DOCKERARGS"
LIVERUNCMD="RunBuilder run -v $DOCKERARGS"

if [ "$1" = "shell" ]; then
  exec RunBuilder exec -ti $CONTAINERNAME /bin/bash
fi
if [ "$1" = "getproxykey" ]; then
  exec RunBuilder exec $CONTAINERNAME /opt/container/get-proxy-key.sh
fi

if [ "$1" != "build" ] && [ "$1" != "push" ] && [ "$1" != "run" ] && [ "$1" != "runline" ] && [ "$1" != "runshell" ]; then
  cat << HERE
- shell:       Launch a shell in a running $CONTAINERNAME container
- getproxykey: Get key for the proxy
- build:       Just build
- run:         Build and run for development (mounts src/ into container)
- runshell:    Build for development, but run a shell instead of the supervisor
- runlive:     Build and run like live (no src/ mount)
HERE
  exit 1
fi

if ! RunBuilder build "${BUILDOPTIONS[@]}" --progress plain -t $TAG . ; then
  echo "Docker build failed"
  exit 1
fi

if [ "$1" = "push" ]; then
  RunBuilder push $TAG
  echo "Pushed $TAG"
  exit 0
fi

if [ "$1" = "run" ]; then
  RunBuilder kill $CONTAINERNAME
  RunBuilder rm $CONTAINERNAME
  exec $DEVELOPRUNCMD -ti $TAG
fi

if [ "$1" = "runlive" ]; then
  RunBuilder kill $CONTAINERNAME
  RunBuilder rm $CONTAINERNAME
  exec $LIVERUNCMD -ti $TAG
fi

if [ "$1" = "runshell" ]; then
  RunBuilder kill $CONTAINERNAME
  RunBuilder rm $CONTAINERNAME
  exec $DEVELOPRUNCMD -ti $TAG /bin/bash
fi

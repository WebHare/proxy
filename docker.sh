#!/bin/sh
cd ${BASH_SOURCE%/*}

CONTAINERNAME=testproxy
if [ -z "$TAG" ]; then
  TAG=nginx-proxy
fi
DEVELOPRUNCMD="docker run -v `pwd`/runtimedata:/opt/webhare-proxy-data/ -v`pwd`/src:/opt/webhare-nginx-proxy/src -p 41080:80 -p 41443:443 -p 45443:5443 --name $CONTAINERNAME"
LIVERUNCMD="docker run -v `pwd`/runtimedata:/opt/webhare-proxy-data/ -p 41080:80 -p 41443:443 -p 45443:5443 --name $CONTAINERNAME"

if [ "$1" == "shell" ]; then
  exec docker exec -ti $CONTAINERNAME /bin/bash
fi
if [ "$1" == "getproxykey" ]; then
  exec docker exec $CONTAINERNAME /root/get-proxy-key.sh
fi

if [ "$1" != "build" -a "$1" != "push" -a "$1" != "run" -a "$1" != "runline" -a "$1" != "runshell" ]; then
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

if ! docker build --pull -t $TAG . ; then
  echo "Docker build failed"
  exit 1
fi

if [ "$1" == "run" ]; then
  docker kill $CONTAINERNAME
  docker rm $CONTAINERNAME
  exec $DEVELOPRUNCMD -ti $TAG
fi

if [ "$1" == "runlive" ]; then
  docker kill $CONTAINERNAME
  docker rm $CONTAINERNAME
  exec $LIVERUNCMD -ti $TAG
fi

if [ "$1" == "runshell" ]; then
  docker kill $CONTAINERNAME
  docker rm $CONTAINERNAME
  exec $DEVELOPRUNCMD -ti $TAG /bin/bash
fi

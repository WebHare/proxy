FROM       docker.io/webhare/baseimage:ubuntu-20
MAINTAINER Arnold Hendriks <arnold@webhare.nl>
ENV LC_ALL=C \
  WEBHAREPROXY_IN_DOCKER=1 \
  WEBHAREPROXY_DATAROOT=/data/ \
  WEBHAREPROXY_FSROOT=/ \
  WEBHAREPROXY_PORT_HTTP=80 \
  WEBHAREPROXY_PORT_HTTPS=443 \
  WEBHAREPROXY_MGMT_HTTP=5080 \
  WEBHAREPROXY_MGMT_HTTPS=5443

# Documentation: https://gitlab.com/webhare/proxy#readme

EXPOSE     80 443 5443
VOLUME     /opt/webhare-proxy-data/

RUN --mount=type=bind,source=/setup-imagebase.sh,target=/setup-imagebase.sh \
    --mount=type=cache,id=webhareproxy1,target=/var/cache/apt \
    --mount=type=cache,id=webhareproxy2,target=/var/lib/apt \
    /bin/bash /setup-imagebase.sh # 2023-02-13

ADD        package.json package-lock.json /opt/webhare-nginx-proxy/

RUN        cd /opt/webhare-nginx-proxy && \
           npm install && \
           npm cache clear --force

ADD        .eslintrc /opt/webhare-nginx-proxy

ADD        src /opt/webhare-nginx-proxy/src

# Running webpack through npm's script runner discarded exit codes
# We always start watch in the container, so it's fine
#RUN        cd /opt/webhare-nginx-proxy && \
#           node_modules/.bin/webpack --config src/webpack-production.config.js --progress --bail

ADD        dropins /
RUN        ln -sf /opt/webhare-proxy-data/ /data

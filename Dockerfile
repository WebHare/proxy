FROM       docker.io/almalinux/10-base
MAINTAINER Arnold Hendriks <arnold@webhare.nl>

ENV LC_ALL=C \
  WEBHAREPROXY_IN_DOCKER=1 \
  WEBHAREPROXY_DATAROOT=/data/ \
  WEBHAREPROXY_FSROOT=/ \
  WEBHAREPROXY_NGINX=/usr/sbin/nginx \
  WEBHAREPROXY_PORT_HTTP=80 \
  WEBHAREPROXY_PORT_HTTPS=443 \
  WEBHAREPROXY_MGMT_HTTP=5080 \
  WEBHAREPROXY_MGMT_HTTPS=5443

# Documentation: https://gitlab.com/webhare/proxy#readme

EXPOSE     80 443 5443
VOLUME     /opt/webhare-proxy-data/

RUN --mount=type=bind,source=/setup-imagebase.sh,target=/setup-imagebase.sh \
    /bin/bash /setup-imagebase.sh # 2025-11-17

ADD        fsroot/opt/webhare-nginx-proxy/package.json fsroot/opt/webhare-nginx-proxy/package-lock.json fsroot/opt/webhare-nginx-proxy/install.sh /opt/webhare-nginx-proxy/

# TODO set up temporary mounts for npm cache, see webhare dockerfile
RUN        "${WEBHAREPROXY_FSROOT}opt/webhare-nginx-proxy/install.sh"

ADD        fsroot /
RUN        ln -sf /opt/webhare-proxy-data/ /data

# Add a label with the commit SHA
ARG CI_COMMIT_SHA
ARG CI_COMMIT_REF_NAME
ARG CI_PIPELINE_ID
ARG CI_COMMIT_TAG
LABEL dev.webhare.proxy.git-commit-sha="$CI_COMMIT_SHA" \
      dev.webhare.proxy.git-commit-ref="$CI_COMMIT_REF_NAME" \
      dev.webhare.proxy.git-commit-time="$CI_COMMIT_TIMESTAMP" \
      dev.webhare.proxy.pipelineid="$CI_PIPELINE_ID" \
      dev.webhare.proxy.version="$CI_COMMIT_TAG"


CMD        [ "/opt/container/launch.sh" ]

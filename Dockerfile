FROM       webhare/baseimage:ubuntu-20
MAINTAINER Arnold Hendriks <arnold@webhare.nl>

# Documentation: https://gitlab.com/webhare/proxy#readme

EXPOSE     80 443 5443
VOLUME     /opt/webhare-proxy-data/

# Add letsencrypt's repo - https://certbot.eff.org/lets-encrypt/ubuntubionic-other
# Ensure the openssl secure renegotiation vulnerability is fixed
RUN        /opt/container/install.sh nginx-full git nodejs tzdata letsencrypt npm

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

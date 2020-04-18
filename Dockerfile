FROM       phusion/baseimage:0.11
MAINTAINER Arnold Hendriks <arnold@webhare.nl>

# Documentation: https://gitlab.com/webhare/proxy#readme

EXPOSE     80 443 5443
VOLUME     /opt/webhare-proxy-data/
CMD        [ "/opt/container/launch.sh" ]

# Add letsencrypt's repo - https://certbot.eff.org/lets-encrypt/ubuntubionic-other
RUN        ( curl -sL https://deb.nodesource.com/setup_10.x | bash - ) && \
           apt-get update && \
           apt-get install software-properties-common && \
           add-apt-repository universe && \
           add-apt-repository ppa:certbot/certbot && \
           install_clean nginx-full git nodejs tzdata letsencrypt

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

# Move logrotate state into container state
RUN        rm -rf /var/lib/logrotate && ln -sf /opt/webhare-proxy-data/var/logrotate /var/lib/

# Move letsencrypt data folders to permanent storage
RUN        rm -rf /etc/letsencrypt /var/lib/letsencrypt /var/log/letsencrypt/ \
            && ln -sf /opt/webhare-proxy-data/letsencrypt/etc /etc/letsencrypt \
            && ln -sf /opt/webhare-proxy-data/letsencrypt/lib /var/lib/letsencrypt \
            && ln -sf /opt/webhare-proxy-data/letsencrypt/log /var/log/letsencrypt


ADD        dropins /
RUN        chmod 644 /etc/logrotate.conf /etc/logrotate.d/webhare-nginx-proxy.conf

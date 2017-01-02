FROM       gitlab-registry.b-lex.com/webhare_com/servermanagement:base-phusion-latest
MAINTAINER Arnold Hendriks <arnold@b-lex.nl>

# To test, something like:  (you always want to persist a volume or you'll have to wait for DH parameter generation every test, which takes a LONG time)
# docker run --rm -v ~/my-nginx-proxy/data:/opt/webhare-proxy-data/ -p 8081:80 -p 8082:443 -p 8083:5443 --name my-nginx-proxy gitlab-registry.b-lex.com/webhare_com/servermanagement:nginx-proxy-latest

# to run a shell inside the container (debugging)
# docker run --rm -v ~/my-nginx-proxy/data:/opt/webhare-proxy-data/ -p 8081:80 -p 8082:443 -p 8083:5443 --name my-nginx-proxy -ti gitlab-registry.b-lex.com/webhare_com/servermanagement:nginx-proxy-latest /bin/sh

# to get the secret key from the container for setting up connections (and currently, management)
# docker exec my-nginx-proxy /root/get-proxy-key.sh

EXPOSE     80 443 5443
VOLUME     /opt/webhare-proxy-data/
CMD        [ "/sbin/my_init" ]

RUN        apt-get update && \
           apt-get install -y nginx-full git logrotate && \
           apt-get clean && rm -rf /tmp/* /var/tmp/*

ADD        package.json /opt/webhare-nginx-proxy/package.json

RUN        cd /opt/webhare-nginx-proxy && \
           npm install && \
           npm cache clear #2016-08-09 23:52

ADD        .eslintrc /opt/webhare-nginx-proxy

ADD        src /opt/webhare-nginx-proxy/src

# Running webpack through npm's script runner discarded exit codes
# We always start watch in the container, so it's fine
#RUN        cd /opt/webhare-nginx-proxy && \
#           node_modules/.bin/webpack --config src/webpack-production.config.js --progress --bail

ADD        dropins /
RUN        chmod 644 /etc/logrotate.conf /etc/logrotate.d/webhare-nginx-proxy.conf

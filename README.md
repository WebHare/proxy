# WebHare Proxy

This project contains the configuration server for a WebHare reverse proxy. This nginx based proxy can help to take
some load off WebHare, implements SNI allowing you to host mulitple secure websites with separate SSL certificates on a single
IP address (which is not natively supported by the WebHare webserver).

The proxy also allows you to host multiple instances of WebHare on the same proxy.

## Installation
You should set up a data dir for the /opt/webhare-proxy/data/ volume.

Example docker calling syntax which assumes /dockers/my-nx/proxy-data/ will host the volume

```
docker run --name my-nx -p 80:80 -p 443:443 -p 5443:5443 -v /dockers/my-nx/proxy-data/:/opt/webhare-proxy-data/ webhare/proxy:master
```

Alternatively, you can run the docker container in the 'host' network namespace (`--network host`). You may find you need this to properly capture client's IP addresses, especially over IPv6.

The first time the container is started, it will generate new DH parameters. This may take quite a while.
The management interface on port 5443 will not be available until this is done.

## Management
The proxy offers a management interface on port 5443 which is reachable over https (and uses as self-signed certificate)

You can login using the proxy key as the password

## Customizing

Extra nginx configuration files can be dropped as `*.conf` into `/opt/webhare-proxy-data/etc/nginx-http/` - they will be included inside the 'http' section.

Extra configuration files can also be dropped as `*.conf` into `/opt/webhare-proxy-data/etc/nginx-other/` - they will be included at the root level.

If you're using the host network namespcae, nginx can be told to bind to a specific IPv4 address by setting the NGINX_BINDTO_IPV4 environment variable.

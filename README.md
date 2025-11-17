# WebHare Proxy
https://gitlab.com/webhare/proxy

This project contains the configuration server for a WebHare reverse proxy. This nginx based proxy can help to take
some load off WebHare and implements SNI allowing you to host mulitple secure websites with separate SSL certificates on a single
IP address (which is not natively supported by the WebHare webserver).

The proxy also allows you to host multiple instances of WebHare on the same proxy and IP address.

## Installation
You should set up a data dir for the /opt/webhare-proxy-data/ volume.

Example docker calling syntax which assumes /dockers/my-nx/proxy-data/ will host the volume, publishing management port 5443.

```bash
docker run --name my-nx -p 80:80 -p 443:443 -p 5443:5443 -v /dockers/my-nx/proxy-data/:/opt/webhare-proxy-data/ webhare/proxy:master
```

Alternatively, you can run the docker container in the 'host' network namespace (`--network host`). You may find you need this to properly capture client's IP addresses, especially over IPv6.

The first time the container is started, it will generate new DH parameters. This may take a while.

## Management
The proxy offers a management interface on http://127.0.0.1:5080 and https://127.0.0.1:5443/

You can login using the proxy key as the password. To get the proxy key execute `/opt/container/get-proxy-key.sh`

If you've configured WEBHAREPROXY_ADMINHOSTNAME and WEBHAREPROXY_LETSENCRYPTEMAIL the proxy will set up a secured management interface on `https://$WEBHAREPROXY_ADMINHOSTNAME/` (ie it can then
share port 80/443 with the hosted webservers). We recommend setting WEBHAREPROXY_ADMINHOSTNAME to the server's hostname. The server will request a LetsEncrypt certificate at startup but you can
force it by invoking `/opt/container/setup-adminhost-certbot.sh`.

## Customizing

Extra nginx configuration files can be dropped as `*.conf` into `/opt/webhare-proxy-data/etc/nginx-http/` - they will be included inside the 'http' section.

Extra configuration files can also be dropped as `*.conf` into `/opt/webhare-proxy-data/etc/nginx-other/` - they will be included at the root level.

Configuration files dropped as `*.conf` into `/opt/webhare-proxy-data/etc/nginx-adminserver/` will be included on the admin hostname (configured by WEBHAREPROXY_ADMINHOSTNAME)

If you're using the host network namespcae, nginx can be told to bind to a specific IPv4 address by setting the WEBHAREPROXY_BINDTO_IPV4 environment variable.

If you want to remap the listen ports, set the environment variables WEBHAREPROXY_INSECUREPORT and WEBHAREPROXY_SECUREPORT.

## Making a new release
The CI scripts take care of deploying to Docker. Simply push a new tag

## Running the proxy from the source tree
We recommend using runkit:
- Start the proxy with `runkit run-proxy --nocontainer`
- Open it with `runkit open-proxy`
- See any data in `~/whrunkit/_proxy/data`

When invoked this way `~/whrunkit/_settings/publichostname` will be used for WEBHAREPROXY_ADMINHOSTNAME, the hostname of the admin interface

Otherwise:
- use `./proxy.sh runlocal` to start the proxy locally. Consider using WebHare

See the [developer documentation](DEVELOEPRS.MD) for more details and recipes

## Troubleshooting
The nginx configuration is generated as `/data/nginx.conf`. If you patch this file use `/opt/container/reload.sh` to reload it.
Use `/opt/webhare-nginx-proxy/src/nginx-proxy.js --regenerate` to regenerate the configuration file.

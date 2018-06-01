# WebHare Proxy

This project contains the configuration server for a webhare reverse proxy.

## Installation
You should set up a data dir for the /opt/webhare-proxy/data/ volume.

Example docker calling syntax which assumes /dockers/my-nx/proxy-data/ will host the volume
```
/usr/bin/docker run --name my-nx -p 80:80 -p 443:443 -p 5443:5443 -v /dockers/my-nx/proxy-data/:/opt/webhare-proxy-data/ gitlab-registry.webhare.com/webhare/nginx-proxy:master
```

The first time the container is started, it will generate new DH parameters. This may take quite a while.
The management interface on port 5443 will not be available until this is done.

## Customizing
Extra nginx configuration files can be dropped as *.conf into /opt/webhare-proxy-data/etc/nginx-http/ - they will be included inside the 'http' section

Extra configuration files can also be dropped as *.conf into /opt/webhare-proxy-data/etc/nginx-other/ - they will be included at the root level

nginx can be told to bind to a specific IPv4 address by setting the NGINX_BINDTO_IPV4 environment variable

## Development
All development that is done in the 'src' directory, can be run under a docker
container. This allows development against the proper nginx version, even under OSX
(and makes sure your environment matches the live environment as close as possible)

```
cd ~/projects/nginx-proxy
./docker.sh run
```

To get the proxy key, use
```
docker exec testproxy /opt/container/get-proxy-key.sh
```

You can then access the management interface on https://127.0.0.1:45443/ using user 'webhare' and the proxykey obtained above

To connect this nginx-proxy back to WebHare on OSX:
- Add an extra loopback address for testing, eg `sudo ifconfig lo0 alias 10.55.55.55` - machines in docker will be able to connect here
- Add a proxy in WebHare in the webservers application
  - URL: https://127.0.0.1:45443/ (the webhare/nginx-proxy management interface)
  - Password: the proxy key retrieved above
  - Local connect address: http://10.55.55.55:13684 (WebHare on an IP reachable by the docker container)

The docker container publishes its internal ports 80 and 443 on 41080 and 41443, so your sites
should be available on these ports (eg https://webhare.moe.sf.b-lex.com:41443/ )

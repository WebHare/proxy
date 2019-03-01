## Development
All development done in the 'src' directory, can be run under a docker
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

### OSX development tips
To connect this nginx-proxy back to WebHare on OSX:
- Add an extra loopback address for testing, eg `sudo ifconfig lo0 alias 10.55.55.55` - machines in docker will be able to connect here
- Add a proxy in WebHare in the webservers application
  - URL: https://127.0.0.1:45443/ (the webhare/nginx-proxy management interface)
  - Password: the proxy key retrieved above
  - Local connect address: http://10.55.55.55:13684 (WebHare on an IP reachable by the docker container)

The docker container publishes its internal ports 80 and 443 on 41080 and 41443, so your sites
should be available on these ports (eg https://webhare.moe.sf.b-lex.com:41443/ )

## Development
All development done in the 'src' directory, can be run in a Podman
container. This allows development against the proper nginx version, even under OSX
(and makes sure your environment matches the live environment as close as possible)

```bash
cd ~/projects/proxy
./proxy.sh run
```

To get the proxy key, use
```bash
./proxy.sh getproxykey
```
The reverse proxy will be available on http://127.0.0.1:41080/ and https://127.0.0.1:41443/

You can access the management interface on https://127.0.0.1:41443/admin/ using user 'webhare' and the proxykey obtained above. (and for historical reasons, also on https://127.0.0.1:45443/)

### Other useful commands

To get a shell inside the proxy
```bash
./proxy.sh shell
```

The `codewatch` service watches the admin UI source and rebuilds its assets automatically. To build the UI once outside the container:

```bash
cd fsroot/opt/webhare-nginx-proxy
npm run build:admin
```

The config server serves the generated assetpack directly, so frontend changes do not require a config-server restart. To restart the config server after changing its server-side code:

```bash
podman exec testproxy sv restart configserver
```

### OSX development tips
To connect this nginx-proxy back to WebHare on OSX:
- Add an extra loopback address for testing, eg `sudo ifconfig lo0 alias 10.55.55.55` - machines in the Podman VM will be able to connect here
- Make sure WebHare's secure port listens to this address, eg by starting it `WEBHARE_SECUREPORT_BINDIP=10.55.55.55 wh console`
- Add a proxy in WebHare in the webservers application
  - URL: https://127.0.0.1:41443/ (the webhare/nginx-proxy management interface)
  - Password: the proxy key retrieved above
  - Local connect address: http://10.55.55.55:13684 (WebHare on an IP reachable by the Podman container)

The Podman container publishes its internal ports 80 and 443 on 41080 and 41443, so your sites
should be available on these ports (eg https://webhare.moe.sf.b-lex.com:41443/ )

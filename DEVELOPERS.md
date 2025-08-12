# proxy development
To run proxy locally next to an existing WebHare source install, start that WebHare using `WEBHARE_WEBSERVER=nginx`. This will trigger the HareScript webserver to only open its 'trusted' port

To run proxy locally: `./proxy.sh runlocal`

To test a container version locally with a local WebHare, launch WebHare with `WEBHARE_SECUREPORT_BINDIP=0.0.0.0 WEBHARE_WEBSERVER=nginx wh console
` and the proxy as follows:

```bash
sudo ifconfig lo0 alias 10.55.55.55 # Setting up an additional IP on localhost makes your mac easily routable for podman/docker

podman machine start
podman machine ssh sudo sysctl net.ipv4.ip_unprivileged_port_start=80
./proxy.sh --podman build
echo "runkit.XX.YY.webhare.dev" > ~/whrunkit/_settings/publichostname # this name would also be used by runkit run-proxy, which would normally use 'localhost' as a fallback
runkit run-proxy --image docker.io/webhare/proxy:devbuild

PROXY_PASSWORD="$(podman exec runkit-proxy /opt/container/get-proxy-key.sh)"
wh cli addproxy https://runkit.XX.YY.webhare.dev "$PROXY_PASSWORD" http://10.55.55.55:13684
```

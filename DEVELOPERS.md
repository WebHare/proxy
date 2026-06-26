# proxy development
To run proxy locally next to an existing WebHare source install, start that WebHare using `WEBHARE_WEBSERVER=nginx`.
This will trigger the HareScript webserver to only open its 'trusted' ports

Then choose one of the following paths

## runkit
Even for local development it's easiest to have WebHare and the proxy managed by [runkit](https://github.com/webhare/runkit)

To run the proxy outside a container:

```bash
# Ensure the proxy project is installed and linked into runkit:
runkit list-projects
# If proxy is missing:
runkit link-proxy ~/projects/proxy
# Use run-proxy to run it. It will use $WHRUNKIT_DATADIR/_proxy/data as its data dir
runkit run-proxy --nocontainer
# Open the web interface
runkit open-proxy
# Get the key to log into the proxy
runkit get-proxy-key
```

## fully manual running

To run proxy locally: `./proxy.sh runlocal`

Then access the admin interface on http://127.0.0.1/admin/ - log in using user 'webhare' and the password from localdata/etc/secret.key

To test a container version locally with a local WebHare, launch WebHare with `WEBHARE_SECUREPORT_BINDIP=0.0.0.0 WEBHARE_WEBSERVER=nginx wh console
` and the proxy as follows:

```bash
sudo ifconfig lo0 alias 10.55.55.55 # Setting up an additional IP on localhost makes your mac easily routable for podman/docker

podman machine start
podman machine ssh sudo sysctl net.ipv4.ip_unprivileged_port_start=80
./proxy.sh --podman build
echo "runkit.XX.YY.webhare.dev" > ~/whrunkit/_settings/publichostname # this name would also be used by runkit run-proxy, which would normally use 'localhost' as a fallback
runkit run-proxy --set-image docker.io/webhare/proxy:devbuild

PROXY_PASSWORD="$(podman exec runkit-proxy /opt/container/get-proxy-key.sh)"
wh cli addproxy https://runkit.XX.YY.webhare.dev "$PROXY_PASSWORD" http://10.55.55.55:13684
```

## Container development
```bash
# build
./proxy.sh build
# run
```

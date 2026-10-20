# proxy development
To run the proxy locally next to an existing WebHare source install, start WebHare with `WEBHARE_WEBSERVER=nginx`.
This makes the HareScript webserver open only its trusted ports.

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

## Admin interface development
The admin UI is a small TypeScript DOM application; it does not use React or Material UI. Its esbuild entry point is `fsroot/opt/webhare-nginx-proxy/src/app/app.ts`, which handles RPC polling and actions. `main.ts` renders the interface and `main.css` contains its styles. The build writes `app.js` and `app.css` to `fsroot/opt/adminhost/web/admin/assetpack/`.

The UI gets its data from the `getGUIState` RPC in `src/rpc.ts`. That endpoint long-polls for configuration changes and returns a deliberately limited view: client IDs and registration timestamps, each host's server names, and the proxy version. It does not return host ports or certificate details. Removing a registration uses `guiUnregisterProxyClient`.

From the repository root, build or watch the UI with:

```bash
cd fsroot/opt/webhare-nginx-proxy
npm install
npm run build:admin
npm run watch:admin
```

The watcher writes to the same assetpack directory. `npm run build:admin:production` creates a minified bundle. `./proxy.sh check` installs package dependencies, builds the admin UI, and type-checks the proxy sources. When running the development container with `./proxy.sh run`, its codewatch service watches the UI source and rebuilds the bundle.

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
See [CONTRIBUTING.md](CONTRIBUTING.md) for the container run, key, and service restart commands.

```bash
./proxy.sh build
```

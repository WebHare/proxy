# WebHare Proxy

This project contains the configuration server for a webhare reverse proxy.

## Packaging etc
We've removed the package from github.com from now. we may put it back once we've
decided how we'll solve the gitlab-registry.b-lex.com/webhare_com/servermanagement:nginx-machine-latest dependency
as we don't want to duplicate that work but don't want to publish the full webhare_com/servermanagement repository

## Installation
You should set up a data dir for the /opt/webhare-proxy/data/ volume.

Example docker calling syntax which assumes /dockers/my-nx/proxy-data/ will host the volume
```
/usr/bin/docker run --name my-nx -p 80:80 -p 443:443 -p 5443:5443 -v /dockers/my-nx/proxy-data/:/opt/webhare-proxy-data/ gitlab-registry.b-lex.com/webhare/nginx-proxy:master
```

The first time the container is started, it will generate new DH parameters. This may take quite a while.
The management interface on port 5443 will not be available until this is done.

## Development
All development that is done in the 'src' directory, can be run under a docker
container. This allows development against the Linux versions under OSX (and makes
sure your environment matches the live environment as close as possible)

```
cd ~/projects/nginx-proxy
./docker.sh run
```

Then, go to https://127.0.0.1:45443/

Set up in webhare and then access eg https://webhare.moe.sf.b-lex.com:41443/

## Development subcommands
Get the proxy key (used to connect)
```
./docker.sh getproxykey
```

## Customizing
Extra nginx configuration files can be dropped as *.conf into /opt/webhare-proxy-data/etc/nginx-http/ - they will be included inside the 'http' section

Extra configuration files can also be dropped as *.conf into /opt/webhare-proxy-data/etc/nginx-other/ - they will be included at the root level

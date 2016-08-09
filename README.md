# WebHare Proxy

This project contains the configuration server for a webhare reverse proxy.

# Installation

First, checkout this repository and read the README.

- Create custom DH parameters
  ```
  openssl dhparam -out /etc/nginx/webhare-proxy-dhparam.pem 2048
  ```

- Make sure nginx is installed. On Centos7, adjust the configuration file /etc/nginx.conf so that the pid is stored at /run/nginx.pid, where systemd expexts it to be.

- Make sure the node and npm are installed (and reasonably new versions at that)

- Then run (to install required node modules)

  ```
  npm install
  ```
- To create the bundles for the web-interface, run

  ```
  npm run-script build
  ```

- Create a config folder. The default folder is /opt/webhare-proxy-data

- Create the subfolder $CONFIGDIR/ssl_config and place a SSL key and certificate chain in the files ssl.crt and ssl.key.

If you're fine with using a self-signed cert, run the commands below, and make sure the Common name is a valid hostname for your server. The rest of the fields don't matter.
```
mkdir /opt/webhare-proxy-data/ssl_config
cd /opt/webhare-proxy-data/ssl_config
openssl genrsa -out ssl.key 2048
openssl req -new -x509 -nodes -sha1 -days 365 -key ssl.key > ssl.crt
```

- If you're on Linux: Enable and start nginx
  ```
  systemctl enable nginx
  systemctl start nginx
  ```

- If you're on a Mac: brew info nginx and follow the 'To have launchd start nginx at login' and 'Then to load nginx now' instructions.

- Start the configuration server.
  Override the standard configuration folder with `--configdir=FOLDER`, and the standard port (5443) with `--port=PORT`.

  ```
  node nginx-config-server.js --install
  ```

  To restart nginx on brew: `brew services restart nginx`

After completing this step, you have a functioning proxy configuration server. The Nginx configuration will be overwritten the first time a client registers with this proxy.

To access the server, user the username *webhare* and use the password that is saved to the *secret.key* file in the configuration folder.
The HTTPS server will listen on all local IPs on the specified port (default 5443).

# Setting up nginx as root on OSX
- sudo ~/projects/proxy/misc/configure_ngingx_as_root.sh

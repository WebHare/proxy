"use strict";

const co = require("co");
const fs = require("fs");
const crypto = require("crypto");
const child_process = require("child_process");

const Config = require("./config");
const Tools = require("./tools");

let min_supported_version = 1;
let max_supported_version = 1;

function comparePorts(a, b)
{
  if (a.port !== b.port)
    return a.port < b.port;
  // The booleans might be undefined
  if (!a.ipv6 !== !b.ipv6)
    return !a.ipv6 ;
  if (!a.ssl !== !b.ssl)
    return !a.ssl;
  return 0;
}

function generateNginxConfig(override_id, override_config)
{
  let config = "";

  config += `
user www-data;
worker_processes auto;
error_log /opt/webhare-proxy-data/log/error.log info;
pid /var/run/nginx.pid;

include             /opt/webhare-proxy-data/etc/nginx-other/*.conf;

events {
  worker_connections 1024;
}

http {
  log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" $host $server_port $content_length '
                    '"$http_x_forwarded_for" $sent_http_content_type $request_time';

  access_log /opt/webhare-proxy-data/log/access.log main;
  large_client_header_buffers 4 16k;

  sendfile            on;
  tcp_nopush          on;
  tcp_nodelay         on;
  keepalive_timeout   65;
  types_hash_max_size 2048;

  include             /etc/nginx/mime.types;
  include             /opt/webhare-proxy-data/etc/nginx-http/*.conf;
  default_type        application/octet-stream;

  server_names_hash_bucket_size 256;

  ssl_protocols TLSv1.2;
  ssl_dhparam /opt/webhare-proxy-data/etc/webhare-proxy-dhparam.pem;
  ssl_prefer_server_ciphers on;
  ssl_session_cache shared:SSL:10m;
  ssl_session_timeout 10m;

  #20 m = about 160.000 keys
  proxy_cache_path /opt/webhare-proxy-data/cache/maincache levels=1:2 keys_zone=maincache:20m max_size=10g inactive=240m use_temp_path=off;

  gzip on;
  gzip_vary on;
  gzip_proxied any;
  gzip_types text/xml application/json application/xml text/css application/javascript text/plain text/csv text/calendar text/x-vcard;
`;
  let allports = [];

  let ip4bindto = process.env["NGINX_BINDTO_IPV4"] || '';
  if(ip4bindto)
    ip4bindto += ':';

  let serverprolog = "    server_tokens off;\n";

  Config.clients.forEach(client =>
  {
    if (client.id === override_id)
      client = override_config;

    if (client.version < min_supported_version || client.version > max_supported_version)
    {
      console.log('version problem');
      throw new Error("This Nginx installation does not support request format " + client.version + ", allowed are " + min_supported_version + "-" + max_supported_version);
    }

    // Process all the certificates from this client
    let certs = {};
    client.certificates.forEach(cert =>
    {
      let sha256 = crypto.createHash("sha256");
      let hash = sha256.update(cert.keyfile + "\t" + cert.chainfile, "utf8").digest("hex");

      let keys_dir = Tools.ensureStorageDir("keystore");

      let ssl_path_key = keys_dir + "/" + hash + ".key";
      let ssl_path_cert = keys_dir + "/" + hash + ".crt";

      fs.writeFileSync(ssl_path_key, cert.keyfile);
      fs.writeFileSync(ssl_path_cert, cert.chainfile);

      certs[cert.name] = { cert_path: ssl_path_cert, key_path: ssl_path_key };
    });

    client.hosts.forEach(host =>
    {
      config += "  server { \n" + serverprolog;

      host.ports.forEach(port =>
      {
        if( (port.port===80 && port.ssl) || (port.port===443 && (!port.ssl || !host.ssl_keypair)))
          return;

        config +=
            `    listen ${port.ipv6?"[::]:":ip4bindto}${port.port}${port.ssl?" ssl http2":""};\n`;

        let idx = allports.findIndex(a => (comparePorts(a, port) === 0));
        if (idx === -1)
          allports.push(port);
      });

      config +=
          `    server_name ${host.servernames.join(" ")};\n`;

      if (host.ssl_keypair)
      {
        let cert = certs[host.ssl_keypair];

        config +=
            "    ssl_certificate " + cert.cert_path + ";\n"
          + "    ssl_certificate_key " + cert.key_path + ";\n";

        if (client.ssl_ciphers)
        {
          config +=
              "    ssl_ciphers " + client.ssl_ciphers + ";\n";
        }
      }

      config += (host.server_settings || client.default_server_settings) + "\n";
      config +=
        "  }\n\n";
    });
  });

  config += "  server { \n" + serverprolog;

  allports.forEach(port =>
  {
    if(port.port === 443 && !port.ssl)
      return;

    config +=
        `    listen ${port.ipv6?"[::]:":ip4bindto}${port.port}${port.ssl?" ssl":""} default_server;\n`;
  });

  let ssl_config_dir = Tools.ensureStorageDir("etc/ssl_config");

  config +=
      "    ssl_certificate " + ssl_config_dir + "/ssl.crt;\n"
    + "    ssl_certificate_key " + ssl_config_dir + "/ssl.key;\n"
    + "    ssl_protocols TLSv1.2;\n"
    + "    server_name _;\n"
    + "    return 404;\n"
    + "  }\n"
    + "}\n";

  return config;
}

function testNginxConfig(configdata)
{
  return co(function * testNginxConfig()
  {
    // Write the temporary config file
    let testpath = Tools.ensureStorageDir() + "var/nginx.conf.test";
    fs.writeFileSync(testpath, configdata);

    // Run the process, catch the return code and output
    let process;
    let output = new Promise(resolve => process = child_process.exec("/usr/sbin/nginx -t -c" + " " + testpath, (e, stdout, stderr) => resolve({ e, stdout, stderr })));
    let process_result = yield new Promise(resolve => process.on("exit", resolve));
    output = yield output;

    if (process_result !== 0)
      throw new Error("Validation error: " + output.stdout + output.stderr);

    return process_result === 0;
  });
}

function applyNginxConfig(configdata, saveconfig)
{
  return co(function * applyNginxConfig()
  {
    let finalpath = "/opt/webhare-proxy-data/etc/nginx.conf";
    let testpath = finalpath + ".apply_tmp";

    let configsdir = Tools.ensureStorageDir("var/applied_configs");
    let datestr = new Date().toISOString().replace(/[-:.]/g, "");
    fs.writeFileSync(configsdir + `/nginx.${datestr}.conf`, configdata);

    // Write the configuration file, and move it over the old file
    fs.writeFileSync(testpath, configdata);
    fs.renameSync(testpath, finalpath);

    fs.writeFileSync(testpath, configdata);

    // Reload the configuration of nginx
    let process;
    let output = new Promise(resolve => process = child_process.exec("/usr/sbin/nginx -s reload", (e, stdout, stderr) => resolve({ e, stdout, stderr })));
    let process_result = yield new Promise(resolve => process.on("exit", resolve));
    output = yield output;

    // Test if reload went ok
    if (process_result !== 0)
      throw new Error("Error reloading new configuration: " + output.stdout + output.stderr);

    if (saveconfig)
      Config.write();
  });
}


module.exports =
  { generateNginxConfig:    generateNginxConfig
  , testNginxConfig:        testNginxConfig
  , applyNginxConfig:       applyNginxConfig
  , min_supported_version:  1
  , max_supported_version:  1
  };

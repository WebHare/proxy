"use strict";

const co = require("co");
const fs = require("fs");
const crypto = require("crypto");
const child_process = require("child_process");

const Config = require("./config");
const Tools = require("./tools");

let min_supported_version = 1;
let max_supported_version = 1;

function generateNginxConfig(override_id, override_config)
{
  let config = "";

  config += `
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log;
pid /run/nginx.pid;

events {
  worker_connections 1024;
}

http {
  log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

  access_log  /var/log/nginx/access.log  main;

  sendfile            on;
  tcp_nopush          on;
  tcp_nodelay         on;
  keepalive_timeout   65;
  types_hash_max_size 2048;

  include             /etc/nginx/mime.types;
  default_type        application/octet-stream;

  server_names_hash_bucket_size 256;

`;

  Config.clients.forEach(client =>
  {
    if (client.id == override_id)
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
      config +=
          "  server {\n";

      host.ports.forEach(port =>
      {
        config +=
            `    listen ${port.ipv6?"[::]:":""}${port.port}${port.ssl?" ssl":""};\n`;
      });

      config +=
          `    server_name ${host.servernames.join(" ")};\n`;

      if (host.ssl_keypair)
      {
        let cert = certs[host.ssl_keypair];

        config +=
            "    ssl_certificate " + cert.cert_path + ";\n"
          + "    ssl_certificate_key " + cert.key_path + ";\n"
          + "    ssl_protocols TLSv1 TLSv1.1 TLSv1.2;\n";

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

  config +=
      "}\n";

  return config;
}

function testNginxConfig(configdata)
{
  return co(function * testNginxConfig()
  {
    // Write the temporary config file
    let testpath = Tools.ensureStorageDir() + "nginx.conf.test";
    fs.writeFileSync(testpath, configdata);

    // Run the process, catch the return code and output
    let process;
    let output = new Promise(resolve => process = child_process.exec("/usr/sbin/nginx -t -c " + testpath, (e, stdout, stderr) => resolve({ e, stdout, stderr })));
    let process_result = yield new Promise(resolve => process.on("exit", resolve));
    output = yield output;

    if (process_result !== 0)
      throw new Error("Validation error: " + output.stdout + output.stderr);

    return process_result == 0;
  });
}

function applyNginxConfig(configdata)
{
  return co(function * applyNginxConfig()
  {
    let testpath = "/etc/nginx/nginx.conf.apply_tmp";
    let finalpath = "/etc/nginx/nginx.conf";

    let configsdir = Tools.ensureStorageDir("applied_configs");
    let datestr = new Date().toISOString().replace(/[-:.]/g, "");
    fs.writeFileSync(configsdir + `/nginx.${datestr}.conf`, configdata);

    // Write the configuration file, and move it over the old file
    fs.writeFileSync(testpath, configdata);
    fs.renameSync(testpath, finalpath);

    fs.writeFileSync(testpath, configdata);

    // Reload the configuration of nginx
    let process;
    let output = new Promise(resolve => process = child_process.exec("service nginx reload", (e, stdout, stderr) => resolve({ e, stdout, stderr })));
    let process_result = yield new Promise(resolve => process.on("exit", resolve));
    output = yield output;

    // Test if reload went ok
    if (process_result != 0)
      throw new Error("Error reloading new configuration: " + output.stdout + output.stderr);

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


import * as fs from "fs";
import * as crypto from "crypto";
import * as child_process from "child_process";
import * as process from "process";

import * as config from "./config.ts";
import * as Tools from "./tools.ts";

export const min_supported_version = 1;
export const max_supported_version = 1;

function comparePorts(a: { port: number; ipv6: boolean; ssl: boolean }, b: { port: number; ipv6: boolean; ssl: boolean }) {
  if (a.port !== b.port)
    return a.port < b.port;
  // The booleans might be undefined
  if (!a.ipv6 !== !b.ipv6)
    return !a.ipv6;
  if (!a.ssl !== !b.ssl)
    return !a.ssl;
  return 0;
}

function generateLocationConfig(client: config.Client, host: config.ClientHost, upstreamurl: string, hostTweaks: config.HostTweaks) {
  // client_max_body_size: html5 uploads only require 10m, but module pushes need more. we'll settle for this for webdav too then
  let result = `
    proxy_http_version    1.1;
    proxy_request_buffering off;
    proxy_buffering off;
    proxy_read_timeout    600s;
    client_max_body_size  700m;\

    location /
    {
      proxy_set_header      Connection "";
      proxy_pass            ${upstreamurl};
      proxy_set_header      Host $http_host;
      proxy_set_header      X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header      X-Forwarded-Proto $scheme;
      proxy_set_header      X-WebHare-Proxy ${client.proxyid};
      add_header            X-Accel-Redirect $upstream_http_x_next_accel_redirect;
      proxy_hide_header     X-Next-Accel-Redirect;
      add_header            X-Accel-Buffering $upstream_http_x_next_accel_buffering;
      proxy_hide_header     X-Next-Accel-Buffering;
      proxy_hide_header     X-WebHare-ProxyOptions;
      add_header            Server-Timing $servertiming;\n
    }
`;

  for (const url of hostTweaks?.urls || []) {
    result += `    # Host tweak for URL ${url.regexp}
    location ~* ${url.regexp} {
      return ${url.blockWithStatus};
    }
`;
  }

  result += `    # Standard config: forward websockets
    location ~* \\.whsock$
    {
      proxy_http_version    1.1;
      proxy_set_header      Upgrade $http_upgrade;
      proxy_set_header      Connection "upgrade";
      proxy_pass            ${upstreamurl};
      proxy_set_header      Host $http_host;
      proxy_set_header      X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header      X-Forwarded-Proto $scheme;
      proxy_set_header      X-WebHare-Proxy ${client.proxyid};
    }
`;
  return result;
}


export function generateNginxConfig(override_client?: config.Client) {
  const tweaks = config.loadTweaks();
  let configFile = "";

  configFile += `
user nginx;
worker_processes auto;
error_log ${config.currentConfig.data_storage_path}/log/error.log info;
error_log ${config.currentConfig.data_storage_path}/log/emerg.log emerg;
pid ${config.currentConfig.data_storage_path}/var/nginx.pid;

include             ${config.currentConfig.data_storage_path}/etc/nginx-other/*.conf;

events {
  worker_connections 25000;
}

http {
  resolver 8.8.8.8 8.8.4.4; # FIXME or use the parent machine's local unbound

  # Alphabetical index of variables: http://nginx.org/en/docs/varindex.html
  log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" $host $server_port $content_length '
                    '"$sent_http_content_type" $upstream_addr $ssl_protocol $ssl_cipher'
                    'rqt=$request_time uct=$upstream_connect_time uht=$upstream_header_time urt=$upstream_response_time';

  access_log ${config.currentConfig.data_storage_path}/log/access.log main;
  large_client_header_buffers 4 16k;

  sendfile            on;
  tcp_nopush          on;
  tcp_nodelay         on;
  keepalive_timeout   65;
  types_hash_max_size 2048;

  include             ${process.env.WEBHAREPROXY_FSROOT}opt/webhare-nginx-proxy/src/data/mime.types;
  include             ${config.currentConfig.data_storage_path}/etc/nginx-http/*.conf;
  default_type        application/octet-stream;

  server_names_hash_bucket_size 256;

  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_dhparam ${process.env.WEBHAREPROXY_FSROOT}opt/webhare-nginx-proxy/src/data/ffdhe3072.pem;

  ssl_prefer_server_ciphers on;
  ssl_session_cache shared:SSL:10m;
  ssl_session_timeout 10m;

  #20 m = about 160.000 keys
  proxy_cache_path ${config.currentConfig.data_storage_path}/cache/maincache levels=1:2 keys_zone=maincache:20m max_size=10g inactive=240m use_temp_path=off;
  proxy_cache_path ${config.currentConfig.data_storage_path}/cache/authcache levels=1:2 keys_zone=authcache:10m max_size=1g  inactive=60m  use_temp_path=off;

  # Ensure Range support for file/image cache requests (they would return 200 on first hit was SendWebFile doesn't do Range)
  proxy_force_ranges on ;

  gzip on;
  gzip_vary on;
  gzip_proxied no_etag;
  gzip_types text/xml application/json application/xml text/css application/javascript text/plain text/csv text/calendar text/x-vcard;

  # Support larger headers and upstream responses. Larger headers were needed to deal with larger data in wrdauth JWT and frontend data.
  proxy_buffer_size          128k;
  proxy_buffers              4 256k;
  proxy_busy_buffers_size    256k;

  # Detect text/html, only those have use for IP info
  map $upstream_http_content_type $upstream_content_type
  {
    "~^text/html" html;
    default "";
  }
  map "$upstream_content_type:$upstream_http_x_webhare_proxyoptions" $servertiming
  {
    # Look for word (\\b..\\b) 'addremoteip' option (X-WebHare-ProxyOptions) enabled on a HTML (text/html) file. If set, we'll add the remote address. Quoted so it doesn't get truncated at ipv6 :
    ~^html:.*\\baddremoteip\\b 'remoteip;desc="$remote_addr"';
    default "";
  }
`;
  const allports: config.Client["hosts"][number]["ports"] = [];

  let ip4bindto = process.env["WEBHAREPROXY_BINDTO_IPV4"] || '';
  if (ip4bindto)
    ip4bindto += ':';

  const port_insecure = parseInt(process.env["WEBHAREPROXY_INSECUREPORT"] || "0") || 80;
  const port_secure = parseInt(process.env["WEBHAREPROXY_SECUREPORT"] || "0") || 443;

  const ssl_config_dir = Tools.ensureStorageDir("etc/ssl_config");
  const serverprolog = "    server_tokens off;\n    http2 on;\n";

  const adminhostname = process.env["WEBHAREPROXY_ADMINHOSTNAME"];
  let certpath = `/etc/letsencrypt/live/${adminhostname}/fullchain.pem`;
  let keypath = `/etc/letsencrypt/live/${adminhostname}/privkey.pem`;
  if (!fs.existsSync(certpath)) {
    certpath = `${ssl_config_dir}/${adminhostname}.crt`;
    keypath = `${ssl_config_dir}/${adminhostname}.key`;
  }

  if (adminhostname) {
    configFile += `
    server {
      ${serverprolog}
      listen [::]:${port_insecure};
      listen ${ip4bindto}${port_insecure};
      listen [::]:${port_secure} ssl;
      listen ${ip4bindto}${port_secure} ssl;
      server_name ${adminhostname};
      ssl_certificate ${certpath};
      ssl_certificate_key ${keypath};
      ssl_protocols TLSv1.2 TLSv1.3;

      #WebHare 4.30 default cipher list:
      ssl_ciphers ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-SHA384:ECDHE-ECDSA-AES256-SHA:ECDHE-ECDSA-AES128-SHA256:ECDHE-ECDSA-AES128-SHA:ECDHE-RSA-AES256-SHA384:ECDHE-RSA-AES256-SHA:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES128-SHA:DHE-RSA-AES256-GCM-SHA384:DHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-SHA256:DHE-RSA-AES256-SHA:DHE-RSA-AES128-SHA256:DHE-RSA-AES128-SHA;

      proxy_http_version    1.1;
      #  proxy_request_buffering off;
      #  proxy_buffering off;
      proxy_read_timeout    600s;
      client_max_body_size  700m;
      root ${process.env.WEBHAREPROXY_FSROOT}/opt/adminhost/web/ ;

      location /admin/
      {
        proxy_pass http://127.0.0.1:5080/;
      }

      include ${config.currentConfig.data_storage_path}/etc/nginx-adminserver/*.conf;
    }
`;
  }

  const clients = [...config.currentConfig.clients];
  if (override_client) {
    const idx = clients.findIndex(c => c.id === override_client.id);
    if (idx !== -1)
      clients[idx] = override_client;
    else
      clients.push(override_client);
  }

  clients.forEach(client => {
    if (client.version < min_supported_version || client.version > max_supported_version) {
      console.log('version problem');
      throw new Error("This Nginx installation does not support request format " + client.version + ", allowed are " + min_supported_version + "-" + max_supported_version);
    }

    let upstreamurl = '';
    if (client.proxyid && client.reverseaddress) {
      const upstreamname = client.reverseaddress.replaceAll(/[:.-/]/g, '_');
      //recreate a http:// or https:// url to match the original address
      upstreamurl = client.reverseaddress.split(':')[0] + "://" + upstreamname;

      configFile += `
  upstream ${upstreamname} {
    server ${new URL(client.reverseaddress).host};
    keepalive 60;
  }
`;
    }

    // Process all the certificates from this client
    const certs: Record<string, { cert_path: string; key_path: string }> = {};
    client.certificates.forEach(cert => {
      const sha256 = crypto.createHash("sha256");
      const hash = sha256.update(cert.keyfile + "\t" + cert.chainfile, "utf8").digest("hex");

      const keys_dir = Tools.ensureStorageDir("keystore");

      const ssl_path_key = keys_dir + "/" + hash + ".key";
      const ssl_path_cert = keys_dir + "/" + hash + ".crt";

      fs.writeFileSync(ssl_path_key + ".tmp", cert.keyfile);
      fs.renameSync(ssl_path_key + ".tmp", ssl_path_key);
      fs.writeFileSync(ssl_path_cert + ".tmp", cert.chainfile);
      fs.renameSync(ssl_path_cert + ".tmp", ssl_path_cert);

      certs[cert.name] = { cert_path: ssl_path_cert, key_path: ssl_path_key };
    });

    client.hosts.forEach(host => {
      configFile += "  server { \n" + serverprolog;

      host.ports.forEach(port => {
        if ((port.port === 80 && port.ssl) || (port.port === 443 && (!port.ssl || !host.ssl_keypair)))
          return;

        // Only allow port 80 and 443 and remap them
        let portnr;
        if (port.port === 80)
          portnr = port_insecure;
        else if (port.port === 443)
          portnr = port_secure;
        else
          return;

        configFile +=
          `    listen ${port.ipv6 ? "[::]:" : ip4bindto}${portnr}${port.ssl ? " ssl" : ""};\n`;

        const idx = allports.findIndex(a => (comparePorts(a, port) === 0));
        if (idx === -1)
          allports.push(port);
      });

      configFile +=
        `    server_name ${host.servernames.join(" ")};\n`;

      const cert = certs[host.ssl_keypair];
      if (cert) { //if the referred cert was actually shipped.. (WH pre-5.4 would mention a nonexisting 'fallback' certificate)
        configFile +=
          "    ssl_certificate " + cert.cert_path + ";\n"
          + "    ssl_certificate_key " + cert.key_path + ";\n";

        if (client.ssl_ciphers) {
          configFile +=
            "    ssl_ciphers " + client.ssl_ciphers + ";\n";
        }
      }

      const hostTweaks: config.HostTweaks = {
        urls: []
      };
      for (const [server, serverTweaks] of Object.entries(tweaks?.server || {})) {
        if (host.servernames.includes(server)) {
          hostTweaks.urls!.push(...serverTweaks.urls || []);
        }
      }

      if (client.proxyid && client.reverseaddress)
        configFile += generateLocationConfig(client, host, upstreamurl, hostTweaks);
      else //FIXME block this path if we're sure no servers use it
        configFile += (host.server_settings || client.default_server_settings || "") + "\n";

      configFile +=
        "  }\n\n";
    });
  });

  configFile += "  server { \n" + serverprolog;

  allports.forEach(port => {
    if (port.port === 443 && !port.ssl)
      return;

    configFile +=
      `    listen ${port.ipv6 ? "[::]:" : ip4bindto}${port.port}${port.ssl ? " ssl" : ""} default_server;\n`;
  });


  configFile +=
    "    ssl_certificate " + ssl_config_dir + "/ssl.crt;\n"
    + "    ssl_certificate_key " + ssl_config_dir + "/ssl.key;\n"
    + "    ssl_protocols TLSv1.2 TLSv1.3;\n"
    + "    server_name _;\n"
    + "    return 404;\n"
    + "  }\n"
    + "}\n";

  return configFile;
}

type ChildProcessOutput = {
  e: Error | null;
  stdout: string;
  stderr: string;
};

export async function testNginxConfig(configdata: string) {
  // Write the temporary config file
  const testpath = Tools.ensureStorageDir() + "var/nginx.conf.test";
  fs.writeFileSync(testpath, configdata);

  // Run the process, catch the return code and output
  let process2!: child_process.ChildProcess;
  //FIXME don't rely on shell arg parser
  const outputPromise = new Promise<ChildProcessOutput>(resolve => process2 = child_process.exec(`${process.env.WEBHAREPROXY_NGINX} -t -c ${testpath}`, (e, stdout, stderr) => resolve({ e, stdout, stderr })));
  const process_result = await new Promise(resolve => process2.on("exit", resolve));
  const output = await outputPromise;

  if (process_result !== 0)
    throw new Error("Validation error: " + output.stdout + output.stderr);

  return process_result === 0;
}

export async function applyNginxConfig(configdata: string, saveconfig?: boolean) {
  const finalpath = `${config.currentConfig.data_storage_path}/etc/nginx.conf`;
  const testpath = finalpath + ".apply_tmp";

  const configsdir = Tools.ensureStorageDir("var/applied_configs");
  const datestr = new Date().toISOString().replace(/[-:.]/g, "");
  fs.writeFileSync(configsdir + `/nginx.${datestr}.conf`, configdata);

  // Write the configuration file, and move it over the old file
  fs.writeFileSync(testpath, configdata);
  fs.renameSync(testpath, finalpath);

  fs.writeFileSync(testpath, configdata);

  // Reload the configuration of nginx if its running
  let nginxpid;
  try {
    nginxpid = fs.readFileSync(`${process.env.WEBHAREPROXY_DATAROOT}var/nginx.pid`);
  } catch (ignore) {

  }
  if (nginxpid && nginxpid.toString()) {
    let proc: child_process.ChildProcess;
    const outputPromise = new Promise<ChildProcessOutput>(resolve => proc = child_process.exec(`${process.env.WEBHAREPROXY_FSROOT}opt/container/reload.sh`, (e, stdout, stderr) => resolve({ e, stdout, stderr })));
    const process_result = await new Promise(resolve => proc.on("exit", resolve));
    const output = await outputPromise;

    // Test if reload went ok
    if (process_result !== 0)
      throw new Error("Error reloading new configuration: " + output.stdout + output.stderr);
  }

  if (saveconfig)
    config.saveConfiguration();
}

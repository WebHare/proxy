"use strict";

const co = require("co");
const fs = require("fs");
const crypto = require("crypto");
const https = require("https");
const rpc = require("node-json-rpc");
const child_process = require("child_process");

let data_storage_path = "/opt/webhare-proxy-data";
let clients = [];
let secretkey = "";

function ensureDir(path)
{
  try
  {
    // Throws if the dir does not exist
    fs.lstatSync(path);
  }
  catch (e)
  {
    fs.mkdirSync(path);
  }
}

function ensureStorageDir(append)
{
  ensureDir(data_storage_path);
  let path = data_storage_path + "/" + (append||"");
  ensureDir(path);
  return path;
}

function generateNginxConfig(override_id, override_config)
{
  let config = "";

  if (override_id) // Test config?
  {
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
  }

  clients.forEach(client =>
  {
    if (client.id == override_id)
      client = override_config;

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

      if (host.ssl_certificate_chain && host.ssl_certificate_key)
      {
        let sha256 = crypto.createHash("sha256");
        let hash = sha256.update(host.ssl_certificate_key + "\t" + host.ssl_certificate_chain, "utf8").digest("hex");

        let keys_dir = ensureStorageDir("keystore");

        let ssl_path_key = keys_dir + "/" + hash + ".key";
        let ssl_path_cert = keys_dir + "/" + hash + ".crt";

        fs.writeFileSync(ssl_path_key, host.ssl_certificate_key);
        fs.writeFileSync(ssl_path_cert, host.ssl_certificate_chain);

        config +=
            "    ssl_certificate " + ssl_path_cert + ";\n"
          + "    ssl_certificate_key " + ssl_path_key + ";\n"
          + "    ssl_protocols TLSv1 TLSv1.1 TLSv1.2;\n";

        if (host.ssl_ciphers)
        {
          config +=
              "    ssl_ciphers " + host.ssl_ciphers + ";\n";
        }
      }

      config += host.server_settings + "\n";
      config +=
        "  }\n\n";
    });

    if (override_id) // Test config?
    {
      config +=
        "}\n";
    }
  });

  return config;
}

function testNginxConfig(configdata)
{
  return co(function * testNginxConfig()
  {
    // Write the temporary config file
    let testpath = ensureStorageDir() + "nginx.conf.test";
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

    let configsdir = ensureStorageDir("applied_configs");
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

    saveConfiguration();
  });
}

// registerProxyClient is called by a webhare to register the hosts it needs forwarded
let registerProxyClient = co.wrap(function * registerProxyClient(config)
{
  if (arguments.length != 1)
    throw new Error("Expected one parameter");

  if (!config.id)
    throw new Error("Require a installation id");

  console.log(config.secretkey);
  console.log(secretkey);

  if (config.secretkey != secretkey)
    throw new Error("Authorization failure");

  let new_rec =
      { hosts: config.hosts || []
      };

  let client = clients.find(i => i.id === config.id);
  if (!client)
  {
    client = { id: config.id, hosts: [] };
    clients.push(client);
  }

  // Generate the config from all last valid configs, but with the new config for this client
  let configfile = generateNginxConfig(config.id, new_rec);

  // Test that generated config file
  let testresult = yield testNginxConfig(configfile);
  if (!testresult)
    throw new Error("Configuration did not validate");

  // Apply the changes to the client, and generate+deploy the final config
  Object.assign(client, new_rec);
  yield applyNginxConfig(generateNginxConfig());

  console.log("Applied configuration from: " + config.id);
  return { success: true };
});

/** Wraps a promise-returning function for the RPC server addMethod callback, splitting out the arguments list into individual parameters
    @param func Promise-returning function.
*/
function wrapAsyncJSONRPCFunction(func)
{
  return function(params, callback)
  {
    Promise.resolve(params)
      .then(x => func.apply(null, x))
      .then(result => callback(null, result), error =>
      {
        // Maybe detect something as invalidParamError?
        callback({ code: -32604, message: error.stack }, null);
      });
  }
}

/// Read the last valid configuration from disk
function readSavedConfiguration()
{
  try
  {
    let saved_config = fs.readFileSync(data_storage_path + "/config.json");
    if (saved_config)
    {
      let parsed_config = JSON.parse(saved_config);
      if (parsed_config)
      {
        clients = parsed_config.clients;
        console.log("Read persistent configuration from disk");
      }
    }
  }
  catch (e)
  {
  }

  try
  {
    secretkey = fs.readFileSync(data_storage_path + "/secret.key", "utf8").trim();
  }
  catch (e)
  {
  }

  if (!secretkey)
    secretkey = crypto.randomBytes(32).toString("hex");

  saveConfiguration();
}

function saveConfiguration()
{
  // Save the current valid config to disk
  let saved_config = JSON.stringify(
      { clients: clients
      });

  fs.writeFileSync(data_storage_path + "/config.json", saved_config);
  fs.writeFileSync(data_storage_path + "/secret.key", secretkey);
}

function sendReply(res, error, result, id)
{
  let message = { id: id };
  if (error)
    message.error = error;
  else
    message.result = result;

  res.end(JSON.stringify(message));
}

function handleRPCRequest(jsondata, res)
{
  let decoded;
  try
  {
    decoded = JSON.parse(jsondata);
  }
  catch (e)
  {
    return sendReply(res, { code: -32700, message: "Could not parse request" })
  }

  if (typeof decoded != "object" || !decoded)
    return sendReply(res, { code: -32600, message: "Invalid request, not an object" });

  if (typeof decoded.method != "string")
    return sendReply(res, { code: -32600, message: "Invalid request, missing method" }, null, decoded.id);
  if (typeof decoded.params != "object" || !decoded.params instanceof Array)
    return sendReply(res, { code: -32600, message: "Invalid request, missing params" }, null, decoded.id);

  let method;
  switch (decoded.method)
  {
    case "registerProxyClient": method = registerProxyClient; break;
  }

  if (!method)
    return sendReply(res, { code: -32601, message: "No such method '" + decoded.method + "'" });

  Promise.resolve(true)
      .then(() => method.apply(null, decoded.params))
      .then(result => sendReply(res, null, result, decoded.id), error => sendReply(res, { code: -32604, message: error.stack }));
}

/// Starts the RPC server, starts handling incoming RPCs
function startServer()
{
  var ssl_config_dir = ensureStorageDir("ssl_config");
  let keyfile, certfile;
  try
  {
    keyfile = fs.readFileSync(ssl_config_dir + "/ssl.key").toString() || "";
  }
  catch (e)
  {
    fs.writeFileSync(ssl_config_dir + "/ssl.key", "");
  }
  try
  {
    certfile = fs.readFileSync(ssl_config_dir + "/ssl.crt").toString() || "";
  }
  catch (e)
  {
    fs.writeFileSync(ssl_config_dir + "/ssl.crt", "");
  }

  let server = https.createServer(
      { key: keyfile
      , cert: certfile
      }, (req, res) =>
  {
    let data = "";
    req.on("data", bytes => data += bytes);
    req.on("end", () => handleRPCRequest(data, res));
  });

  server.listen(5443);
}

readSavedConfiguration();
startServer();

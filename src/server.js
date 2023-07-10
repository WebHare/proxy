"use strict";

const fs = require("fs");
const crypto = require("crypto");
const http = require("http");
const https = require("https");
const child_process = require("child_process");
const BasicAuth = require('basic-auth');
const Path = require('path');

const Config = require('./config');
const RPCs = require('./rpc');
const Tools = require("./tools");
const RPCSupport = require("./rpcsupport");
const NginxConfig = require("./nginx-config");

let currentversion = '';

function handleRequest(req, postdata, res)
{
  // Handle basic authentication
  let auth = BasicAuth(req);
  if (!auth || auth.name != "webhare" || auth.pass != Config.secretkey)
  {
    res.statusCode = 401;
    res.setHeader('WWW-Authenticate', 'Basic realm="WebHare Proxy"');
    return res.end('Access denied');
  }

  if (req.method == "POST" && req.url.match(/^\/rpc(\?.*)?$/))
    return handleRPCRequest(req, postdata, res);
  if (req.method == "POST" && req.url.match(/^\/admin\/rpc(\?.*)?$/))
    return handleRPCRequest(req, postdata, res);

  let filename = (req.url.match(/^\/([^?]*)(\?.*)?$/) || [])[1];
  let contenttype = "application/octet-stream";
  switch (filename)
  {
  case "":            filename = "index.html"; contenttype = "text/html"; break;
  case "app.js":      contenttype = "application/javascript"; break;
  case "app.js.map":  break;
  case "main.css":    contenttype = "text/css"; break;
  default:
    {
      res.statusCode = 403;
      res.statusMessage = "Not found";
      return res.end("Not found");
    }
  }

  let path = Path.join(__dirname, '../build/' + filename);
  let stat = fs.statSync(path);
  console.log(path, stat.size);

  res.writeHead(200,
    { "Content-Type":     contenttype
    , "Content-Length":   stat.size
    , "Cache-Control":    "no-cache, no-store, must-revalidate"
    , "Pragma":           "no-cache"
    , "Expires":          "0"
    });

  var stream = fs.createReadStream(path);
  stream.pipe(res);
}

function handleRPCRequest(req, jsondata, res)
{
  let decoded;
  try
  {
    decoded = JSON.parse(jsondata);
  }
  catch (e)
  {
    return RPCSupport.sendReply(res, { code: -32700, message: "Could not parse request" })
  }

  if (typeof decoded != "object" || !decoded)
    return RPCSupport.sendReply(res, { code: -32600, message: "Invalid request, not an object" });

  if (typeof decoded.method != "string")
    return RPCSupport.sendReply(res, { code: -32600, message: "Invalid request, missing method" }, null, decoded.id);
  if (typeof decoded.params != "object" || !decoded.params instanceof Array)
    return RPCSupport.sendReply(res, { code: -32600, message: "Invalid request, missing params" }, null, decoded.id);

  let method = RPCs[decoded.method];
  if (!method)
    return RPCSupport.sendReply(res, { code: -32601, message: "No such method '" + decoded.method + "'" });

  Promise.resolve(true)
      .then(() => method.apply(null, decoded.params))
      .then(result => RPCSupport.sendReply(res, null, result, decoded.id), error => RPCSupport.sendReply(res, { code: -32604, message: error.stack }));
}

async function updateConfiguration()
{
  // Generate the config
  const configfile = NginxConfig.generateNginxConfig();

  // Test that generated config file
  const testresult = await NginxConfig.testNginxConfig(configfile);
  if (!testresult)
    throw new Error("Initial configuration did not validate");

  await NginxConfig.applyNginxConfig(configfile);
  console.log("Nginx configuration updated");
}

async function regenerateConfiguration() {
  Config.read();
  const configfile = NginxConfig.generateNginxConfig();

  const testresult = await NginxConfig.testNginxConfig(configfile);
  if (!testresult)
    throw new Error("Generated configuration did not validate");

  await NginxConfig.applyNginxConfig(configfile);
  console.log("Nginx configuration updated");
}

/// Starts the RPC server, starts handling incoming RPCs
function startServer()
{
  var ssl_config_dir = Tools.ensureStorageDir("etc/ssl_config");
  let keyfile  = "", certfile ="";

  try
  {
    keyfile = fs.readFileSync(ssl_config_dir + "/ssl.key").toString() || "";
    certfile = fs.readFileSync(ssl_config_dir + "/ssl.crt").toString() || "";
  }
  catch(ignore)
  {

  }

  let servercallback = (request, response) =>
  {
    let data = "";
    request.on("data", bytes => data += bytes);
    request.on("end", () => handleRequest(request, data, response));
  };


  if(keyfile && certfile)
  {
    let server_config =
        { key: keyfile
        , cert: certfile
        };

    let server = https.createServer(server_config, servercallback);
    server.listen(Config.portnumber);
    console.log(`Listening for requests on secure port ${Config.portnumber}`);
  }
  else
  {
    console.error(`Not starting secure server on port ${Config.portnumber} as we don't have keys for it in ${ssl_config_dir}`);
  }

  if(Config.localhostport)
  {
    let localhostserver = http.createServer(servercallback);
    localhostserver.listen(Config.localhostport, '127.0.0.1');
    console.log(`Listening for requests on insecure localhost port ${Config.localhostport}`);
  }

  console.log("Regenerate nginx configuration");
  updateConfiguration();
}

function run()
{
  Config.read();
  startServer();
}

exports.run = run;
exports.updateConfiguration = updateConfiguration;
exports.regenerateConfiguration = regenerateConfiguration;

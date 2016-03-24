"use strict";

const co = require("co");
const fs = require("fs");
const crypto = require("crypto");
const https = require("https");
const child_process = require("child_process");
const BasicAuth = require('basic-auth');
const Path = require('path');

const Config = require('./config');
const RPCs = require('./rpc');
const Tools = require("./tools");
const RPCSupport = require("./rpcsupport");

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

/// Starts the RPC server, starts handling incoming RPCs
function startServer()
{
  var ssl_config_dir = Tools.ensureStorageDir("ssl_config");
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

  if (!keyfile || !certfile)
    throw new Error("Could not read SSL config from " + ssl_config_dir);

  let server_config =
      { key: keyfile
      , cert: certfile
      };

  let server = https.createServer(server_config, (request, response) =>
  {
    let data = "";
    request.on("data", bytes => data += bytes);
    request.on("end", () => handleRequest(request, data, response));
  });

  console.log("Listening for requests");
  server.listen(Config.portnumber);
}

function run()
{
  Config.read();
  startServer();
}

exports.run = run;

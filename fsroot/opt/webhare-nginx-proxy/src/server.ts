import * as fs from "fs";
import { type IncomingMessage, type ServerResponse } from "http";
import * as http from "http";
import * as https from "https";
import BasicAuth from 'basic-auth';
import * as Path from 'path';

import { currentConfig, readSavedConfiguration } from './config.ts';
import * as RPCs from './rpc.ts';
import * as Tools from "./tools.ts";
import * as RPCSupport from "./rpcsupport.ts";
import * as NginxConfig from "./nginx-config.ts";
import { throwError } from "@webhare/std";

function handleRequest(req: http.IncomingMessage, postdata: string, res: http.ServerResponse) {
  // Handle basic authentication
  const auth = BasicAuth(req);
  if (!auth || auth.name != "webhare" || auth.pass != currentConfig.secretkey) {
    res.statusCode = 401;
    res.setHeader('WWW-Authenticate', 'Basic realm="WebHare Proxy"');
    return res.end('Access denied');
  }

  req.url ??= "/";

  if (req.method == "POST" && req.url.match(/^\/rpc(\?.*)?$/))
    return handleRPCRequest(req, postdata, res);
  if (req.method == "POST" && req.url.match(/^\/admin\/rpc(\?.*)?$/))
    return handleRPCRequest(req, postdata, res);

  let geturl = req.url;
  if (geturl.endsWith("/"))
    geturl += "index.html";

  const filename = (geturl.match(/^\/([^?]*)(\?.*)?$/) || [])[1];
  let contenttype = "application/octet-stream";
  if (filename.endsWith(".html"))
    contenttype = "text/html;charset=utf-8";
  else if (filename.endsWith(".css"))
    contenttype = "text/css";
  else if (filename.endsWith(".js"))
    contenttype = "application/javascript";

  const path = Path.join(process.env.WEBHAREPROXY_FSROOT ?? throwError("WEBHAREPROXY_FSROOT not set"), 'opt/adminhost/web/admin/', geturl);

  try {
    const stat = fs.statSync(path);

    res.writeHead(200, {
      "Content-Type": contenttype,
      "Content-Length": stat.size,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    });

    const stream = fs.createReadStream(path);
    stream.pipe(res);
  } catch (e) {
    res.writeHead(404);
    res.end("File not found");
  }
}

function handleRPCRequest(req: IncomingMessage, jsondata: string, res: ServerResponse) {
  let decoded;
  try {
    decoded = JSON.parse(jsondata);
  } catch (e) {
    return RPCSupport.sendReply(res, { code: -32700, message: "Could not parse request" });
  }

  if (typeof decoded != "object" || !decoded)
    return RPCSupport.sendReply(res, { code: -32600, message: "Invalid request, not an object" });

  if (typeof decoded.method != "string")
    return RPCSupport.sendReply(res, { code: -32600, message: "Invalid request, missing method" }, null, decoded.id);
  if (!Array.isArray(decoded.params))
    return RPCSupport.sendReply(res, { code: -32600, message: "Invalid request, missing params" }, null, decoded.id);

  const method = RPCs.rpcs[decoded.method as keyof typeof RPCs.rpcs];
  if (!method)
    return RPCSupport.sendReply(res, { code: -32601, message: "No such method '" + decoded.method + "'" });

  void Promise.resolve(true)
    .then(() => (method as (...args: unknown[]) => void)(...decoded.params))
    .then(result => RPCSupport.sendReply(res, null, result, decoded.id), error => RPCSupport.sendReply(res, { code: -32604, message: error.stack }));
}

export async function updateConfiguration() {
  // Generate the config
  const configfile = NginxConfig.generateNginxConfig();

  // Test that generated config file
  const testresult = await NginxConfig.testNginxConfig(configfile);
  if (!testresult)
    throw new Error("Initial configuration did not validate");

  await NginxConfig.applyNginxConfig(configfile);
  console.log("Nginx configuration updated");
}

export async function regenerateConfiguration() {
  readSavedConfiguration();
  const configfile = NginxConfig.generateNginxConfig();

  const testresult = await NginxConfig.testNginxConfig(configfile);
  if (!testresult)
    throw new Error("Generated configuration did not validate");

  await NginxConfig.applyNginxConfig(configfile);
  console.log("Nginx configuration updated");
}

/// Starts the RPC server, starts handling incoming RPCs
function startServer() {
  const ssl_config_dir = Tools.ensureStorageDir("etc/ssl_config");
  let keyfile = "", certfile = "";

  try {
    keyfile = fs.readFileSync(ssl_config_dir + "/ssl.key").toString() || "";
    certfile = fs.readFileSync(ssl_config_dir + "/ssl.crt").toString() || "";
  } catch (ignore) {

  }

  const servercallback = (request: IncomingMessage, response: ServerResponse) => {
    let data = "";
    request.on("data", bytes => data += bytes);
    request.on("end", () => handleRequest(request, data, response));
  };


  if (keyfile && certfile) {
    const server_config =
    {
      key: keyfile,
      cert: certfile
    };

    const server = https.createServer(server_config, servercallback);
    server.listen(currentConfig.portnumber);
    console.log(`[configserver] Listening for requests on secure port ${currentConfig.portnumber}`);
  } else {
    console.error(`[configserver] Not starting secure server on port ${currentConfig.portnumber} as we don't have keys for it in ${ssl_config_dir}`);
  }

  if (currentConfig.localhostport) {
    const localhostserver = http.createServer(servercallback);
    localhostserver.listen(currentConfig.localhostport, '127.0.0.1');
    console.log(`[configserver] Listening for requests on insecure localhost port ${currentConfig.localhostport}`);
  }

  console.log("[configserver] Regenerate nginx configuration");
  updateConfiguration();
}

export function run() {
  console.log("[configserver] run");
  readSavedConfiguration();
  console.log("[configserver] startServer");
  startServer();
}

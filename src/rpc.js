"use strict";

const co = require("co");
const crypto = require("crypto");
const http = require("http");
const fs = require("fs");
const url = require("url");

const Config = require("./config");
const Tools = require("./tools");
const NginxConfig = require("./nginx-config");

let currentversion = '';

let verifyClient = co.wrap(function * verifyClient(reverseaddress, verificationurl)
{
  let parsed_reverseaddr = url.parse(reverseaddress);
  let parsed_verificationurl = url.parse(verificationurl);

  let options =
      { protocol: parsed_reverseaddr.protocol
      , host: parsed_reverseaddr.hostname
      , port: parsed_reverseaddr.port
      , path: parsed_verificationurl.path
      , headers:  { Host: parsed_verificationurl.hostname
                  , "X-Forwarded-Proto": "https"
                  }
      }

  console.log(options);

  return new Promise((resolve, reject) =>
  {
    const req = http.get(options, res =>
    {
      let body = "";
      res.on("data", data => body += data);
      res.on("end", () =>
      {
        console.log('<' + body + '>');
        if (res.statusCode === 200 && body === "ok")
          resolve();
        else if (body === "Wrong proxy verification code")
        {
          console.log("Verification of reverse addr", reverseaddress, "with url", verificationurl, "failed: wrong verification code");
          reject(new Error("Proxy verification failed, wrong verification code"));
        }
        else if (res.statusCode === 404)
        {
          console.log("Verification of reverse addr", reverseaddress, "with url", verificationurl, "failed: 404, domain probably not hosted on reverse address");
          reject(new Error("Proxy verification failed, got 404"));
        }
        else
        {
          console.log("Verification of reverse addr", reverseaddress, "with url", verificationurl, "failed: http code " + res.statusCode + " and unrecognized response");
          reject(new Error("Proxy verification failed, http code " + res.statusCode + " and unrecognized response"));
        }
      })
    });

    // an error is always problematic
    req.on("error", e =>
    {
      console.log("Verification of reverse addr", reverseaddress, "with url", verificationurl, "failed:", e.message);
      reject(new Error(e.message));
    });

    req.end();

    // Also set a timeout
    setTimeout(() =>
    {
      reject(new Error("Timeout for retrieving verification (waited 10 seconds)"))
    }, 10000);
  });
});

// Used to test connectivity
exports.test = co.wrap(function * test(reverseaddress, verificationurl)
{
  try
  {
    // Connect to the reverse address via the verification url
    yield verifyClient(reverseaddress, verificationurl);
  }
  catch (e)
  {
    return { success: false, code: "verificationfailed" };
  }

  return { success: true };
});

// registerProxyClient is called by a webhare to register the hosts it needs forwarded
exports.registerProxyClient = co.wrap(function * registerProxyClient(config)
{
  if (arguments.length != 1)
    throw new Error("Expected one parameter");

  if (!config.id)
    throw new Error("Require a installation id");

  if (!config.reverseaddress || !config.verificationurl)
    throw new Error("Require a reverse address and verificationurl");

  let client = Config.clients.find(i => i.id === config.id);
  if(client && client.lastset && !(config.lastset > config.lastset))
    throw new Error(`Refusing configuration with registration timestamp '${config.lastset || 'not provided'}' as we already have a registration with '${client.lastset}'`);

  // Connect to the reverse address via the verification url
  yield verifyClient(config.reverseaddress, config.verificationurl);

  // Remove id and secretkey from config
  let new_rec = Object.assign({}, config);
  delete new_rec.id;
  delete new_rec.secretkey;
  delete new_rec.reverseaddress;
  delete new_rec.verificationurl;

  if (!client)
  {
    // Insert default config, so the config generator will find the new client
    client = { id: config.id, version: 1, hosts: [], certificates: [], ssl_ciphers: "", default_server_settings: "" };
    Config.clients.push(client);
  }

  // Generate the config from all last valid configs, but with the new config for this client
  let configfile = NginxConfig.generateNginxConfig(config.id, new_rec);

  // Test that generated config file
  let testresult = yield NginxConfig.testNginxConfig(configfile);
  if (!testresult)
    throw new Error("Configuration did not validate");

  // Apply the changes to the client, and generate+deploy the final config. Using object.assign to keep 'client' reference intact
  Object.assign(client, new_rec);
  client.lastregistration = Date.now();
  yield NginxConfig.applyNginxConfig(NginxConfig.generateNginxConfig(), true);

  let local_ips = Tools.getLocalIPs();

  console.log("Applied configuration from: " + config.id);
  return { success: true, local_ips: local_ips };
});

// registerProxyClient is called by a webhare to register the hosts it needs forwarded
exports.guiUnregisterProxyClient = co.wrap(function * registerProxyClient(servername)
{
  if (arguments.length != 1)
    throw new Error("Expected one parameter");

  let client = Config.clients.find(i => i.id === servername);
  if (client)
    Config.clients.splice(Config.clients.indexOf(client), 1);

  yield NginxConfig.applyNginxConfig(NginxConfig.generateNginxConfig(), true);

  console.log("Deleted server with id: " + servername);
  return { success: true, found: !!client };
});

exports.unregisterProxyClient = co.wrap(function * registerProxyClient(servername, reverseaddress, verificationurl)
{
  try
  {
    // Connect to the reverse address via the verification url
    yield verifyClient(reverseaddress, verificationurl);
  }
  catch (e)
  {
    return { success: false, code: "verificationfailed" };
  }

  let client = Config.clients.find(i => i.id === servername);
  if (!client)
    return { success: false, code: "notfound" };

  Config.clients.splice(Config.clients.indexOf(client), 1);

  yield NginxConfig.applyNginxConfig(NginxConfig.generateNginxConfig());

  console.log("Deleted server with id: " + servername);
  return { success: true, code: "ok" };
});

exports.getGUIState = co.wrap(function *(counter)
{
  let resolve = null;
  let promise = new Promise(r => resolve = r );

  Config.waitForChange(counter).then(resolve);
  setTimeout(() => resolve(), 10000);

  let r = yield promise;
  return (
      { success: true
      , counter: Config.counter
      , clients: Config.clients.map(c =>
                  {
                    return (
                      { id:   c.id
                      , lastregistration: parseInt(c.lastregistration)
                      , lastset: c.lastset
                      , hosts: c.hosts.map(host => ({ servernames: host.servernames, with_cert: !!host.ssl_keypair }))
                      });
                  })
      , currentversion: currentversion
      });
});

try
{
  currentversion = fs.readFileSync(__dirname + "/../.git/refs/heads/master").toString();
}
catch(e)
{
}

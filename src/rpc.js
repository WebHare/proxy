"use strict";

const co = require("co");
const fs = require("fs");
const crypto = require("crypto");

const Config = require("./config");
const Tools = require("./tools");
const NginxConfig = require("./nginx-config");

// Used to test connectifity
exports.test = function()
{
  return { success: true };
}



// registerProxyClient is called by a webhare to register the hosts it needs forwarded
exports.registerProxyClient = co.wrap(function * registerProxyClient(config)
{
  if (arguments.length != 1)
    throw new Error("Expected one parameter");

  if (!config.id)
    throw new Error("Require a installation id");

  // Remove id and secretkey from config
  let new_rec = Object.assign({}, config);
  delete new_rec.id;
  delete new_rec.secretkey;

  let client = Config.clients.find(i => i.id === config.id);
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

  // Apply the changes to the client, and generate+deploy the final config
  Object.assign(client, new_rec);
  yield NginxConfig.applyNginxConfig(NginxConfig.generateNginxConfig());

  let local_ips = Tools.getLocalIPs();

  console.log("Applied configuration from: " + config.id);
  return { success: true, local_ips: local_ips };
});

// registerProxyClient is called by a webhare to register the hosts it needs forwarded
exports.unregisterProxyClient = co.wrap(function * registerProxyClient(servername)
{
  if (arguments.length != 1)
    throw new Error("Expected one parameter");

  let client = Config.clients.find(i => i.id === servername);
  if (client)
    Config.clients.splice(Config.clients.indexOf(client), 1);

  yield NginxConfig.applyNginxConfig(NginxConfig.generateNginxConfig());

  console.log("Deleted server with id: " + servername);
  return { success: true, found: !!client };
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
      , clients: Config.clients.map(c => c.id)
      });
});

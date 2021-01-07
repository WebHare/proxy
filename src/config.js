"use strict";

const crypto = require("crypto");
const fs = require("fs");

let config =
  { data_storage_path: "/opt/webhare-proxy-data"
  , listenport: 5080
  , listenip: "127.0.0.1"

  , secretkey: ""

  , clients: []
  , counter: 0
  };

let waitpromise = null;
let waitresolve = null;

module.exports = config;

/// Read the last valid configuration from disk
function readSavedConfiguration(resave)
{
  try
  {
    let saved_config = fs.readFileSync(config.data_storage_path + "/var/config.json");
    if (saved_config)
    {
      let parsed_config = JSON.parse(saved_config);
      if (parsed_config)
      {
        config.clients = parsed_config.clients;
        config.counter = parsed_config.counter || 1;
        console.log("Read persistent configuration from disk");
      }
    }
  }
  catch (e)
  {
  }

  try
  {
    config.secretkey = fs.readFileSync(config.data_storage_path + "/etc/secret.key", "utf8").trim();
  }
  catch (e)
  {
  }

  if (!config.secretkey)
    config.secretkey = crypto.randomBytes(32).toString("hex");

  saveConfiguration();
}

function saveConfiguration()
{
  ++config.counter;

  // Save the current valid config to disk
  let saved_config = JSON.stringify(
      { clients: config.clients
      , counter: config.counter
      });

  fs.writeFileSync(config.data_storage_path + "/var/config.json", saved_config);
  fs.writeFileSync(config.data_storage_path + "/etc/secret.key", config.secretkey + "\n");

  if (waitresolve)
  {
    waitresolve(config.counter);
    waitpromise = null;
    waitresolve = null;
  }

  console.log('Saved config', config.counter, config.clients.map(c => c.id));
}

function waitForConfigChange(counter)
{
  if (counter != config.counter)
    return Promise.resolve(config.counter);
  if (!waitpromise)
    waitpromise = new Promise(resolve => waitresolve = resolve);
  return waitpromise;
}

module.exports.read = readSavedConfiguration;
module.exports.write = saveConfiguration;
module.exports.waitForChange = waitForConfigChange;

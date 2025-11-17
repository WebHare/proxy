"use strict";

import crypto from "crypto";
import fs from "fs";

export type ClientHost = {
  ports: Array<{
    port: number;
    ipv6: boolean;
    ssl: boolean;
  }>;
  ssl_keypair: string;
  servernames: string[];
  /// @deprecated When proxyid is set, this is ignored
  server_settings?: string;
};

export type Client = {
  id: string;
  proxyid: string;
  version: number;
  reverseaddress: string;
  lastset: string;
  lastregistration: number;
  certificates: Array<{
    name: string;
    keyfile: string;
    chainfile: string;
  }>;
  hosts: ClientHost[];
  ssl_ciphers?: string;

  /// @deprecated When proxyid is set, this is ignored
  default_server_settings?: string;
};

type Config = {
  data_storage_path: string;
  listenport: number;
  portnumber: number;
  listenip: string;

  secretkey: string;
  clients: Client[];
  counter: number;

  localhostport?: number;
};

export const currentConfig: Config = {
  data_storage_path: process.env["WEBHAREPROXY_DATAROOT"] || "",
  portnumber: 5080,
  listenport: Number(process.env["WEBHAREPROXY_MGMT_HTTP"]) || 0,
  listenip: "127.0.0.1",

  secretkey: "",

  clients: new Array<Client>,
  counter: 0,
};

let waitpromise: Promise<number> | null = null;
let waitresolve: ((value: number) => void) | null = null;

/// Read the last valid configuration from disk
function readSavedConfiguration() {
  try {
    const saved_config = fs.readFileSync(currentConfig.data_storage_path + "/var/config.json", "utf-8");
    if (saved_config) {
      const parsed_config = JSON.parse(saved_config);
      if (parsed_config) {
        currentConfig.clients = parsed_config.clients;
        currentConfig.counter = parsed_config.counter || 1;
        console.log("[configserver] Read persistent configuration from disk");
      }
    }
  } catch (e) {
  }

  try {
    currentConfig.secretkey = fs.readFileSync(currentConfig.data_storage_path + "/etc/secret.key", "utf8").trim();
  } catch (e) {
  }

  if (!currentConfig.secretkey)
    currentConfig.secretkey = crypto.randomBytes(32).toString("hex");

  saveConfiguration();
}

function saveConfiguration() {
  ++currentConfig.counter;

  // Save the current valid config to disk
  const saved_config = JSON.stringify(
    {
      clients: currentConfig.clients,
      counter: currentConfig.counter
    }, null, 2); //prettify output

  fs.writeFileSync(currentConfig.data_storage_path + "/var/config.json", saved_config);
  fs.writeFileSync(currentConfig.data_storage_path + "/etc/secret.key", currentConfig.secretkey + "\n");

  if (waitresolve) {
    waitresolve(currentConfig.counter);
    waitpromise = null;
    waitresolve = null;
  }

  console.log('Saved config counter=', currentConfig.counter, 'clients=', currentConfig.clients.map(c => c.id));
}

function waitForConfigChange(counter: number) {
  if (counter != currentConfig.counter)
    return Promise.resolve(currentConfig.counter);
  if (!waitpromise)
    waitpromise = new Promise(resolve => waitresolve = resolve);
  return waitpromise;
}

export {
  readSavedConfiguration as read,
  saveConfiguration as write,
  waitForConfigChange as waitForChange
};

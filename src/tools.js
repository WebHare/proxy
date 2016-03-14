"use strict";

const Config = require("./config");
const fs = require("fs");
const os = require('os');

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
  ensureDir(Config.data_storage_path);
  let path = Config.data_storage_path + "/" + (append||"");
  ensureDir(path);
  return path;
}

function getLocalIPs()
{
  let result = [];
  let ifaces = os.networkInterfaces();

  Object.keys(ifaces).forEach(ifname =>
  {
    ifaces[ifname].forEach(iface => result.push(iface.address));
  });

  return result;
}


exports.ensureDir = ensureDir;
exports.ensureStorageDir = ensureStorageDir;
exports.getLocalIPs = getLocalIPs;

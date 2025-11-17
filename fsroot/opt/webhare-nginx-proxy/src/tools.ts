"use strict";

import { throwError } from "@webhare/std";
import { currentConfig } from "./config.ts";
import fs from "fs";
import os from 'os';
import { join } from "path";

export function ensureDir(path: string) {
  try {
    // Throws if the dir does not exist
    fs.lstatSync(path);
  } catch (e) {
    fs.mkdirSync(path);
  }
}

export function ensureStorageDir(append?: string) {
  ensureDir(currentConfig.data_storage_path);
  const path = currentConfig.data_storage_path + "/" + (append || "");
  ensureDir(path);
  return path;
}

export function getLocalIPs() {
  const result: string[] = [];
  const ifaces = os.networkInterfaces();

  Object.keys(ifaces).forEach(ifname => {
    ifaces[ifname]?.forEach(iface => result.push(iface.address));
  });

  return result;
}
export function getFSPath(path = "/") {
  return join(process.env.WEBHAREPROXY_FSROOT ?? throwError("WEBHAREPROXY_FSROOT not set"), path);
}

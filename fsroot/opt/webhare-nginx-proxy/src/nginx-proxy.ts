#!/usr/bin/env node

import * as Server from "./server.ts";
import { currentConfig } from "./config.ts";
import { intOption, run } from "@webhare/cli";

run({
  options: {
    configfolder: {
      description: 'configfolder, defaults to ' + currentConfig.data_storage_path,
      default: currentConfig.data_storage_path,
    },
    "port": {
      description: 'port, defaults to ' + currentConfig.portnumber,
      default: currentConfig.portnumber,
      type: intOption(),
    },
    localhostport: {
      description: 'open http localhost-only port',
      type: intOption(),
    },
  },
  flags: {
    resetconfig: "generate empty configuration and exit",
    regenerate: "regenerate configuration and exit",
    install: "install as service",
    uninstall: "uninstall as service",
  },
  async main({ opts }) {

    currentConfig.portnumber = opts.port;

    if (opts.localhostport) {
      currentConfig.localhostport = opts.localhostport;
    } else if (process.env.NGINXPROXY_LOCALHOSTPORT)
      currentConfig.localhostport = parseInt(process.env.NGINXPROXY_LOCALHOSTPORT);

    if (opts.configfolder)
      currentConfig.data_storage_path = opts.configfolder;

    if (opts.resetconfig) {
      Server.updateConfiguration().then(function () { console.log("configuration reset"); }).catch(e => console.error(e));
    } else if (opts.regenerate) {
      Server.regenerateConfiguration().then(function () { console.log("regenerated configuration"); }).catch(e => console.error(e));
    } else {
      console.log("Running on port " + currentConfig.portnumber);
      Server.run();
    }

  }
});

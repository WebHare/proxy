#!/usr/bin/env node

"use strict";

const fs = require("fs");
const child_process = require("child_process");

const Server = require("./src/server");
const Config = require("./src/config");
const GetOpt = require('node-getopt');
const platformsupport = require('./src/platform/' + process.platform);

let opt = require('node-getopt').create(
[ ['' ,  'configfolder=FOLDER' , 'configfolder, defaults to ' + Config.data_storage_path ],
  ['p' , 'port=PORT'           , 'port, defaults to ' + Config.portnumber ],
  ['h' , 'help'                , 'display this help'],
  ['',   'resetconfig'         , 'overwrite config and exit'],
  ['',   'install'             , 'install as service'],
  ['',   'uninstall'           , 'uninstall as service']
])              // create Getopt instance
.bindHelp()     // bind option 'help' to default action
.parseSystem(); // parse command line

if (parseInt(opt.options.port))
  Config.portnumber = parseInt(opt.options.port);

if(opt.options.configfolder)
  Config.data_storage_path = opt.options.configfolder;

if (opt.options.install)
{
  platformsupport.installService(__filename, Config);
  console.log("Service installed");
}
else if (opt.options.uninstall)
{
  platformsupport.uninstallService();
  console.log("Service uninstalled");
}
else if(opt.options.resetconfig)
{
  Server.updateConfiguration().then(function() { console.log("done")});
}
else
{
  console.log("Running on port " + Config.portnumber);
  Server.run();
}

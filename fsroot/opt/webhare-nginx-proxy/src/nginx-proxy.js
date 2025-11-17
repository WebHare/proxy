#!/usr/bin/env node

"use strict";

const fs = require("fs");
const child_process = require("child_process");

const Server = require("./server");
const Config = require("./config");
const Getopt = require('node-getopt/lib/getopt.js');

let opt = Getopt.create(
[ ['' ,  'configfolder=FOLDER' , 'configfolder, defaults to ' + Config.data_storage_path ],
  ['p' , 'port=PORT'           , 'port, defaults to ' + Config.portnumber ],
  ['' ,  'localhostport=PORT'  , 'open http localhost-only port' ],
  ['h' , 'help'                , 'display this help'],
  ['',   'resetconfig'         , 'generate empty configuration and exit'],
  ['',   'regenerate'          , 'regenerate configuration and exit'],
  ['',   'install'             , 'install as service'],
  ['',   'uninstall'           , 'uninstall as service']
])              // create Getopt instance
.bindHelp()     // bind option 'help' to default action
.parseSystem(); // parse command line

if (parseInt(opt.options.port))
  Config.portnumber = parseInt(opt.options.port);

if (opt.options.localhostport)
{
  if(parseInt(opt.options.localhostport))
    Config.localhostport = parseInt(opt.options.localhostport);
}
else if (process.env.NGINXPROXY_LOCALHOSTPORT)
  Config.localhostport = parseInt(process.env.NGINXPROXY_LOCALHOSTPORT);

if(opt.options.configfolder)
  Config.data_storage_path = opt.options.configfolder;

if(opt.options.resetconfig) {
  Server.updateConfiguration().then(function() { console.log("configuration reset")}).catch(e => console.error(e));
} else if(opt.options.regenerate) {
  Server.regenerateConfiguration().then(function() { console.log("regenerated configuration")}).catch(e => console.error(e));
} else {
  console.log("Running on port " + Config.portnumber);
  Server.run();
}

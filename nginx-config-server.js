#!/usr/bin/env node

"use strict";

const Server = require("./src/server");
const Config = require("./src/config");
const GetOpt = require('node-getopt');

let opt = require('node-getopt').create(
[ ['' ,  'configfolder=FOLDER' , 'configfolder, defaults to ' + Config.data_storage_path ],
  ['p' , 'port=PORT'           , 'port, defaults to ' + Config.portnumber ],
  ['h' , 'help'                , 'display this help'],
  ['',   'install'             , 'install as service'],
  ['',   'uninstall'           , 'uninstall as service']
])              // create Getopt instance
.bindHelp()     // bind option 'help' to default action
.parseSystem(); // parse command line

if(parseInt(opt.options.port))
  Config.portnumber = parseInt(opt.options.port);
if(opt.options.configfolder)
  Config.data_storage_path = opt.options.configfolder;

Server.run();

#!/usr/bin/env node

"use strict";

const fs = require("fs");
const child_process = require("child_process");

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

if (parseInt(opt.options.port))
  Config.portnumber = parseInt(opt.options.port);

if(opt.options.configfolder)
  Config.data_storage_path = opt.options.configfolder;

if (opt.options.install)
{
  let unittext =
`
[Unit]
Description=WebHare Nginx proxy configuration server
Requires=nginx.service
After=mysql.service

[Service]
ExecStart=${process.execPath} ${__filename} --configfolder="${Config.data_storage_path}" --port=${Config.portnumber}
Restart=always
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=webhare-nginx-proxy

[Install]
WantedBy=multi-user.target
WantedBy=sockets.target
`;
  fs.writeFileSync("/etc/systemd/system/nginx-config-server.service", unittext);

  child_process.execSync("systemctl daemon-reload");
  child_process.execSync("systemctl enable nginx-config-server");
  child_process.execSync("systemctl start nginx-config-server");
  console.log("Service installed");
}
else if (opt.options.uninstall)
{
  try { child_process.execSync("systemctl stop nginx-config-server"); } catch (e) { console.log("Could not stop service"); }
  try { child_process.execSync("systemctl disable nginx-config-server"); } catch (e) { console.log("Could not disable service"); }
  fs.unlinkSync("/etc/systemd/system/nginx-config-server.service");
  console.log("Service uninstalled");
}
else
{
  console.log("Running on port " + Config.portnumber);
  Server.run();
}

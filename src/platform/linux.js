const fs = require("fs");
const child_process = require("child_process");

function installService(filename, config)
{
  let unittext =
`
[Unit]
Description=WebHare Nginx proxy configuration server
Requires=nginx.service

[Service]
ExecStart=${process.execPath} ${filename} --configfolder=${config.data_storage_path} --port=${config.portnumber}
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

}

function uninstallService()
{
  try { child_process.execSync("systemctl stop nginx-config-server"); } catch (e) { console.log("Could not stop service"); }
  try { child_process.execSync("systemctl disable nginx-config-server"); } catch (e) { console.log("Could not disable service"); }
  fs.unlinkSync("/etc/systemd/system/nginx-config-server.service");
}

exports.installService = installService;
exports.uninstallService = uninstallService;
exports.getNginxPath = function() { return "/usr/sbin/nginx"; }
exports.getNginxMimetypesPath = function() { return "/etc/nginx/mime.types"; }


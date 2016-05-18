

exports.getNginxPath = function() { return "/usr/local/bin/nginx"; }
exports.getNginxMimetypesPath = function() { return "/usr/local/etc/nginx/mime.types"; }
exports.getNginxErrorLogPath = function() { return "/usr/local/var/log/nginx/error.log"; }
exports.getNginxAccessLogPath = function() { return "/usr/local/var/log/nginx/access.log"; }
exports.getNginxPidPath = function() { return "/usr/local/var/run/nginx/nginx.pid"; }
exports.getNginxConfigPath = function() { return "/usr/local/etc/nginx/nginx.conf"; }
exports.getNginxTestCommandline = function() { return "/usr/bin/sudo /usr/local/bin/nginx -t -c"; }
exports.getNginxReloadCommandline = function() { return "/usr/bin/sudo /usr/local/bin/nginx -s reload"; }
exports.getNginxUserName = function() { return "nobody"; }

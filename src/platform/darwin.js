

exports.getNginxPath = function() { return "/usr/local/bin/nginx"; }
exports.getNginxMimetypesPath = function() { return "/usr/local/etc/nginx/mime.types"; }
exports.getNginxErrorLogPath = function() { return "/tmp/nginx-error.log"; }
exports.getNginxAccessLogPath = function() { return "/tmp/nginx-access.log"; }
exports.getNginxPidPath = function() { return "/tmp/nginx.pid"; }
exports.getNginxConfigPath = function() { return "/usr/local/etc/nginx/nginx.conf"; }
exports.getNginxReloadCommandline = function() { return "/usr/local/bin/nginx -s reload"; }

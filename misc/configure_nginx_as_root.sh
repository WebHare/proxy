#!/bin/sh
if [ "`id -u`" != "0" ]; then
  echo Must run as root
  exit 1
fi

cat > /Library/LaunchAgents/com.webhare.nginx-as-root.plist << HERE
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.webhare.nginx-as-root</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/opt/nginx/bin/nginx</string>
        <string>-g</string>
        <string>daemon off;</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/usr/local</string>
    <key>UserName</key>
    <string>root</string>
  </dict>
</plist>
HERE

launchctl unload /Library/LaunchAgents/com.webhare.nginx-as-root.plist 2>/dev/null
launchctl load /Library/LaunchAgents/com.webhare.nginx-as-root.plist

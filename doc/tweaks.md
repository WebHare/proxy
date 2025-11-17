# Tweaks

Proxy v4 introduces tweaks.yml to update the generated configuration without modifying WebHares:

/data/etc/tweaks.yml, example:

```yaml
server:
  my.webhare.ev:
    urls:
    - regexp: ^/forbidden-path/.*
      blockWithStatus: 410
```

after updating, run `/opt/webhare-nginx-proxy/src/nginx-proxy.ts --regenerate` to apply the changes.

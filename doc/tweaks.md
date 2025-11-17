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

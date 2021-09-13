# Changelog
## 3.2.0
- Refuse settings from a WebHare if we already received 'newer' settings for that WebHare.
  This prevents 'older' restored WebHares from overwriting the proxy configuration of the live server.

## 3.1.0 - 2021-07-06
- Fix client verification (response wasn't checked thoroughly)
- Allow /admin/rpc/ as alternative url for direct connections
- Fix CVE-2021-3449 (updates Dockerfile to ensure the fix for CVE-2021-3449 is present)

## 3.0.1 - 2021-01-12
- Support automatic certificate requests for the admin interface through LetsEncyrpt

## 3.0.0 - 2021-01-07
- Move the admin interface inside the proxy

## 2.1.0 - 2021-01-05
- Use standard DH params as recommended by internet.nl
- Increase max connections and other limits for better support for larger events

## 2.0.2 - 2020-04-18
- Disable compression of resources with an E-Tag (gzip_proxied no_etag)

## 2.0.0 - 2018-03-01
- Moved to gitlab.com. Preparing for better OS release.

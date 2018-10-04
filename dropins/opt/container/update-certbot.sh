#!/bin/bash
letsencrypt renew
sv reload nginx

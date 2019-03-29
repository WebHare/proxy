#!/bin/bash
sleep $RANDOM
letsencrypt renew
sv reload nginx

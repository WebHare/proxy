#!/bin/bash
sleep $RANDOM
letsencrypt renew
/opt/container/reload.sh

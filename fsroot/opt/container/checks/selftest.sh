#!/bin/bash

FINALRETVAL=0

for TEST in "${BASH_SOURCE%/*}/"selftest-*.sh ; do
  $TEST
  RETVAL=$?
  if (( RETVAL > FINALRETVAL )); then
    FINALRETVAL=$RETVAL
  fi
done

exit $FINALRETVAL

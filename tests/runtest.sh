#!/bin/bash
npm install @webhare/ts-esbuild-runner undici @webhare/std
./node_modules/.bin/tsrun runtest.ts

# Repository guidance

This is the standalone WebHare nginx proxy project, not a WebHare module. Do not use generic WebHare module validation or test tools here; use the repository's scripts and toolchain.

## Build and validation

- Install the proxy package dependencies with `cd fsroot/opt/webhare-nginx-proxy && npm install`.
- Build the admin frontend with `npm run build:admin` from that package directory. The esbuild entry point is `src/app/app.ts`; output assets go to `fsroot/opt/adminhost/web/admin/assetpack/`.
- Use `npm run build:admin:production` for a minified production frontend bundle.
- The codewatch service runs `npm run watch:admin` and writes to the admin assetpack directory.
- `./proxy.sh check` runs the repository's package setup and TypeScript check.
- `./test.sh` runs Podman-based integration tests. It expects Podman and a prepared `webhare/proxy:devbuild` image; `tests/runtest.sh` is invoked inside the test runner with proxy environment variables, so it is not a standalone unit test.

## Project structure

- Runtime and container configuration live under `fsroot/opt/container/`.
- Proxy TypeScript sources and package configuration live under `fsroot/opt/webhare-nginx-proxy/`.
- The admin frontend source is under `fsroot/opt/webhare-nginx-proxy/src/app/`; its generated assetpack is ignored by Git.
- Follow `DEVELOPERS.md` and `CONTRIBUTING.md` for local proxy, runkit, and container workflows.

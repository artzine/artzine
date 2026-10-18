# Package releases

The SDK and contracts share a package version and canonical contract digest.
Publish artifacts produced by CI on Linux x64 with Node 22.23.2 and pnpm 10.33.2.
Local development supports Node 22.12 or later. Install Chromium once
with `pnpm exec playwright install chromium` for the browser consumer check.

`pnpm verify` checks generated contracts, package boundaries, types and tests,
builds and packs each package, then installs those tarballs into an independent
consumer. That consumer checks Node runtime imports, NodeNext and
Bundler type resolution, and an actual Chromium execution of the browser bundle.
The output in `.artifacts/release/manifest.json` records source, lockfile,
contract, artifact integrity and consumer results. A dirty checkout can prepare
local artifacts but cannot publish them.

Publication runs only in `.github/workflows/release.yml`, dispatched on `main`
with the exact version. npm trusts that workflow through trusted publishing:
each npm command exchanges the job's GitHub OIDC token for a short-lived
credential, so no registry token exists. Both packages' trusted publisher
entries allow `npm dist-tag`, which needs npm 11.21 or later; the workflow
installs it after packing.

1. Dispatch with `action: candidate`. It runs `pnpm release:candidate` to
   publish the exact prepared tarballs with the `next` tag, in dependency
   order, then `pnpm release:verify`. Conflicting existing versions stop the
   entire step before publication. Exact existing versions are verified and
   reused.
2. `pnpm release:verify` reads registry metadata and tarball bytes and runs the
   same independent consumers against exact registry versions. This records
   verification bound to the prepared manifest. It needs no credential and
   also runs locally.
3. After release acceptance, dispatch with `action: promote`. It packs the same
   commit again, verifies the registry holds those exact bytes, then runs
   `pnpm release:promote` to move `latest` to them. Every tag is read back.

A candidate run never promotes `latest`, and each run retains its artifacts.
Publication is resumable: the registry's exact integrity is authoritative for a
version whose earlier response was lost. No command overwrites or unpublishes a
version. Keep the manifest and completed readbacks when reconciling a partial
release. A package release has no atomic transaction across registry entries.

The release tooling uses npm's [tarball publication](https://docs.npmjs.com/cli/v11/commands/npm-publish/)
and [distribution tags](https://docs.npmjs.com/cli/v11/commands/npm-dist-tag/).
It records provider readback; it does not claim registry provenance attestation.

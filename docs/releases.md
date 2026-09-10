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

With `NPM_TOKEN` or `NODE_AUTH_TOKEN` available to the process:

1. Run `pnpm release:candidate` to publish the exact prepared tarballs with the
   `next` tag, in dependency order. Conflicting existing versions stop the entire
   step before publication. Exact existing versions are verified and reused.
2. Run `pnpm release:verify` to read registry metadata and tarball bytes and run
   the same independent consumers against exact registry versions. This records
   verification bound to the prepared manifest.
3. Run `pnpm release:promote` after release acceptance to move `latest` to those
   verified versions. Every tag is read back. The command requires the retained
   registry verification for the same manifest and source.

The candidate workflow runs the first two steps on `main` for an explicitly
requested version and retains the artifacts. It never promotes `latest`.
Publication is resumable: the registry's exact integrity is authoritative for a
version whose earlier response was lost. No command overwrites or unpublishes a
version. Keep the manifest and completed readbacks when reconciling a partial
release. A package release has no atomic transaction across registry entries.

The release tooling uses npm's [tarball publication](https://docs.npmjs.com/cli/v11/commands/npm-publish/)
and [distribution tags](https://docs.npmjs.com/cli/v11/commands/npm-dist-tag/).
It records provider readback; it does not claim registry provenance attestation.

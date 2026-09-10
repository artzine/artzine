# Artzine SDK and contracts

TypeScript packages for publishing, collecting and sharing digital work.

| Package | Purpose |
| --- | --- |
| `@artzine/contracts` | Canonical schemas, typed operations and validation |
| `@artzine/sdk` | Typed API client and direct upload helpers |

Use Node.js 22.12 or later and the pinned pnpm version. Run `pnpm install`,
`pnpm generate`, then `pnpm verify`. Public API definitions live in
`contracts/openapi.yaml`; generated files are checked for drift.

Packages expose explicit entrypoints and perform no network I/O on import.
See the package READMEs for supported usage and the generated API reference
in `docs/api.md`.

AGPL-3.0-only.

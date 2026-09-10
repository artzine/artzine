# @artzine/contracts

Versioned Artzine request and response schemas, TypeScript types, validators,
operation metadata, media presets and entitlement definitions.

```ts
import { parseInput, contractDigest, type Input } from '@artzine/contracts';
const request: Input<'getWork'> = parseInput('getWork', { id: crypto.randomUUID() });
console.log(contractDigest, request.id);
```

`parseInput`, `parseOutput` and `parseSchema` reject unknown properties and invalid
values with `ValidationError`. They never coerce or remove input fields.
For received responses, `@artzine/contracts/consumer` exports `parseResponse`
and `parseErrorResponse`. These accept additive object properties while checking
all known required fields, values and bounds. They preserve the received object
without mutation; extra fields have no advertised TypeScript type. New enum or
union variants are not automatically compatible additions.
Fields belonging to another known object variant cannot be used as extensions;
for example, an unavailable item cannot contain fields describing a work.
`@artzine/contracts/openapi.json` exposes the canonical OpenAPI document.

ES modules. Node 22.12+ and modern browsers. AGPL-3.0-only.

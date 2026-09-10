# @artzine/sdk

The Artzine SDK for Node.js and browsers, with typed API operations, validated
requests and responses, and direct-upload helpers.

```ts
import { createClient } from '@artzine/sdk';
const client = createClient({ baseUrl: 'https://example.org' });
const capabilities = await client.call('getCapabilities', {});
```

Supply your API endpoint explicitly. Use HTTPS, or localhost for development.
Authenticated calls accept a token provider in client options. Mutations require
an idempotency key; retain the same key when retrying the same logical command.
Changed input requires a new key. Handle `ArtzineApiError` using its typed error.
Requests remain strict. Responses tolerate additional object fields, including
nested fields, while rejecting invalid known values or missing required fields.
Added fields are preserved without becoming part of the current TypeScript type.

Use `uploadDirect` with a granted upload slot to transfer a file directly to its
storage endpoint. It sends only the granted fields and file, without your API
credentials. Preserve its returned object version when completing the upload.
Preparing or uploading a work does not publish it: publish the exact ready
preparation version after review.

ES modules. Node 22.12+ and browsers with Fetch, FormData and Web Crypto.
AGPL-3.0-only.

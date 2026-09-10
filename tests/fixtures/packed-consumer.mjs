import assert from "node:assert/strict";
import {
  contractDigest,
  contractVersion,
  parseInput,
  parseOutput,
  ValidationError,
} from "@artzine/contracts";
import { parseResponse } from "@artzine/contracts/consumer";
import { createClient } from "@artzine/sdk";

parseInput("getCapabilities", {});
parseInput("getSubject", { id: "perception" });
parseInput("searchPublic", { medium: "subject" });
const result = {
  release_id: "consumer",
  api_major: 1,
  contract_version: contractVersion,
  contract_digest: contractDigest,
  presets: [],
  added_result: "future",
  limits: {
    storage_bytes: 1073741824,
    published_works: 100,
    collection_entries: 100,
    added_limit: 25,
  },
};
const sdk = createClient({
  baseUrl: "https://example.org",
  fetch: async () =>
    Response.json({
      request_id: "00000000-0000-4000-8000-000000000001",
      contract_version: contractVersion,
      result,
    }),
});
assert.deepEqual((await sdk.call("getCapabilities", {})).result, result);
assert.equal(parseResponse("getCapabilities", result), result);
assert.throws(() => parseOutput("getCapabilities", result), ValidationError);
assert.throws(
  () => parseResponse("getCapabilities", { ...result, api_major: 2 }),
  ValidationError,
);
console.log("Packed consumers passed, including additive response validation.");

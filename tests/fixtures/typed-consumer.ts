import {
  contractDigest,
  contractVersion,
  type Output,
} from "@artzine/contracts";
import { parseResponse } from "@artzine/contracts/consumer";
import { createClient } from "@artzine/sdk";

export async function checkConsumer() {
  const result: Output<"getCapabilities"> = {
    release_id: "package-consumer",
    api_major: 1,
    contract_version: contractVersion,
    contract_digest: contractDigest,
    presets: [],
    limits: {
      storage_bytes: 1024,
      published_works: 100,
      collection_entries: 100,
    },
  };
  const client = createClient({
    baseUrl: "https://example.org",
    fetch: async () =>
      Response.json({
        request_id: "00000000-0000-4000-8000-000000000001",
        contract_version: contractVersion,
        result,
      }),
  });
  const response = await client.call("getCapabilities", {});
  return parseResponse("getCapabilities", response.result).contract_digest;
}

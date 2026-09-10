import { uploadDirect } from "@artzine/sdk";
import { expect, test } from "vitest";

const id = "00000000-0000-4000-8000-000000000001";
test("S3 transfer never includes API authentication and requires an object version", async () => {
  const grant = {
    url: "https://example.s3.ap-southeast-2.amazonaws.com/",
    fields: { key: "quarantine/a" },
    expires_at: new Date(Date.now() + 60000).toISOString(),
    slot_id: id,
    max_bytes: 1024,
  };
  const result = await uploadDirect(grant, new Blob(["image"]), {
    fetch: async (_url, init) => {
      expect(init?.credentials).toBe("omit");
      expect(init?.headers).toBeUndefined();
      expect(init?.body).toBeInstanceOf(FormData);
      return new Response("", {
        status: 201,
        headers: { "x-amz-version-id": "immutable-version" },
      });
    },
  });
  expect(result.sourceVersion).toBe("immutable-version");
  await expect(
    uploadDirect(grant, new Blob(["image"]), {
      fetch: async () => new Response("", { status: 201 }),
    }),
  ).rejects.toThrow("version ID");
});

import {
  contractDigest,
  parseInput,
  parseOutput,
  type Schema,
  ValidationError,
} from "@artzine/contracts";
import { parseErrorResponse, parseResponse } from "@artzine/contracts/consumer";
import { ArtzineApiError, createClient } from "@artzine/sdk";
import { expect, test } from "vitest";

const id = "00000000-0000-4000-8000-000000000001";
const page = {
  export_id: id,
  page: 0,
  entries: [
    {
      kind: "profile",
      data: {
        id,
        handle: "artist",
        display_name: "Artist",
        bio: "",
        links: [{ label: "Portfolio", url: "https://example.org" }],
        selected_work_ids: [],
        version: 1,
      },
    },
  ],
} satisfies Schema<"AccountExportPage">;
const extended = {
  ...page,
  extension: { arbitrary: [null, true] },
  entries: page.entries.map((entry) => ({
    ...entry,
    added_entry_field: "future",
    data: {
      ...entry.data,
      added_profile_field: 42,
      links: entry.data.links.map((link) => ({
        ...link,
        added_link_field: true,
      })),
    },
  })),
};

test("SDK accepts nested additive results from a newer contract without mutation", async () => {
  const before = structuredClone(extended);
  expect(parseResponse("getAccountExportPage", extended)).toBe(extended);
  expect(extended).toEqual(before);
  const sdk = createClient({
    baseUrl: "https://example.org",
    fetch: async () =>
      Response.json({
        request_id: id,
        contract_version: "0.2.0",
        result: extended,
        added_envelope_field: true,
      }),
  });
  const result = await sdk.call("getAccountExportPage", { id, page: 0 });
  expect(result.contract_version).toBe("0.2.0");
  expect(result.result).toEqual(before);
  expect(() => parseOutput("getAccountExportPage", extended)).toThrow(
    ValidationError,
  );
  expect(() => parseInput("getCapabilities", { added_input: true })).toThrow(
    ValidationError,
  );
});

test("known fields, required fields and union variants remain validated", async () => {
  const profile = extended.entries[0];
  if (!profile) throw new Error("Missing profile fixture");
  const invalid = [
    { ...extended, export_id: "bad-id" },
    { ...extended, page: 1024 },
    { ...extended, entries: Array(51).fill(profile) },
    { ...extended, entries: [{ ...profile, kind: "new_variant" }] },
    {
      ...extended,
      entries: [{ ...profile, data: { ...profile.data, version: 0 } }],
    },
    {
      ...extended,
      entries: [
        {
          ...profile,
          data: {
            ...profile.data,
            links: [{ label: "Link", url: "http://example.org" }],
          },
        },
      ],
    },
    { ...extended, entries: [{ kind: "profile", data: { id } }] },
  ];
  for (const value of invalid) {
    const before = structuredClone(value);
    const sdk = createClient({
      baseUrl: "https://example.org",
      fetch: async () =>
        Response.json({
          request_id: id,
          contract_version: "0.2.0",
          result: value,
        }),
    });
    await expect(
      sdk.call("getAccountExportPage", { id, page: 0 }),
    ).rejects.toThrow(ValidationError);
    expect(value).toEqual(before);
  }
});

test("a known union branch cannot mask fields from another branch", () => {
  const value = {
    items: [{ id, unavailable: true, extension: "new" }],
    next_cursor: null,
  };
  expect(parseResponse("listSaves", value)).toBe(value);
  // A partial or malformed work must not pass as an unavailable placeholder.
  for (const fields of [{ title: 42 }, { version: 0 }, { title: "Work" }]) {
    expect(() =>
      parseResponse("listSaves", {
        ...value,
        items: [{ ...value.items[0], ...fields }],
      }),
    ).toThrow(ValidationError);
  }
  const work = {
    id,
    profile_id: id,
    revision_id: id,
    version: 1,
    title: "Work",
    description: "",
    preset: "image.single",
    presentation: "contained",
    alt_text: "",
    credits: [],
    source_download: false,
    assets: [],
    published_at: "2026-09-10T00:00:00.000Z",
    creator: { id, handle: "artist", display_name: "Artist" },
  };
  parseOutput("getWork", work);
  expect(() =>
    parseResponse("listSaves", {
      ...value,
      items: [{ ...work, unavailable: true }],
    }),
  ).toThrow(ValidationError);
  expect(() =>
    parseResponse("listSaves", {
      ...value,
      items: [{ ...work, future_field: true }],
    }),
  ).not.toThrow();
});

test("typed errors accept extensions while preserving known error codes", async () => {
  const payload = {
    request_id: id,
    contract_version: "0.2.0",
    extension: "new",
    error: {
      code: "rate_limited",
      message: "Try again later.",
      retryable: true,
      retry_after: 30,
    },
  };
  const before = structuredClone(payload);
  expect(parseErrorResponse(payload)).toBe(payload);
  expect(payload).toEqual(before);
  const sdk = createClient({
    baseUrl: "https://example.org",
    fetch: async () => Response.json(payload, { status: 429 }),
  });
  await expect(sdk.call("getCapabilities", {})).rejects.toMatchObject({
    name: "ArtzineApiError",
    status: 429,
    requestId: id,
    error: payload.error,
  });
  await expect(sdk.call("getCapabilities", {})).rejects.toBeInstanceOf(
    ArtzineApiError,
  );
  expect(() =>
    parseErrorResponse({
      ...payload,
      error: { ...payload.error, code: "new_code" },
    }),
  ).toThrow(ValidationError);
  expect(() =>
    parseErrorResponse({
      ...payload,
      error: { ...payload.error, retryable: "yes" },
    }),
  ).toThrow(ValidationError);
});

test("capabilities tolerate an older client digest without weakening known limits", () => {
  const value = {
    release_id: "future",
    api_major: 1,
    contract_version: "0.2.0",
    contract_digest: `sha256:${"f".repeat(64)}`,
    presets: [],
    limits: {
      storage_bytes: 1024,
      published_works: 100,
      collection_entries: 100,
      added_limit: 20,
    },
  };
  expect(value.contract_digest).not.toBe(contractDigest);
  expect(parseResponse("getCapabilities", value)).toBe(value);
  expect(() =>
    parseResponse("getCapabilities", { ...value, api_major: 2 }),
  ).toThrow(ValidationError);
  expect(() =>
    parseResponse("getCapabilities", {
      ...value,
      limits: { ...value.limits, storage_bytes: -1 },
    }),
  ).toThrow(ValidationError);
});

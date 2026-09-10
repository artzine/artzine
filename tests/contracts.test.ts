import {
  operations,
  parseInput,
  parseSchema,
  ValidationError,
} from "@artzine/contracts";
import { describe, expect, test } from "vitest";

const id = "00000000-0000-4000-8000-000000000001";
const image = {
  filename: "work.png",
  media_type: "image/png" as const,
  bytes: 1024,
  sha256: "a".repeat(64),
  role: "primary" as const,
};
const draft = {
  title: "A work",
  description: "",
  preset: "image.single" as const,
  presentation: "contained" as const,
  visibility: "public" as const,
  alt_text: "An image",
  credits: [],
  source_download: false,
  assets: [],
  uploads: [image],
};
describe("canonical contract", () => {
  test("rejects unknown fields and unbounded descriptors", () => {
    expect(() =>
      parseInput("prepareWork", {
        profile_id: id,
        control_epoch: 1,
        draft,
        unexpected: true,
      }),
    ).toThrow(ValidationError);
    expect(() =>
      parseSchema("AssetDescriptor", { ...image, bytes: 16777217 }),
    ).toThrow(ValidationError);
    expect(() =>
      parseSchema("AssetDescriptor", { ...image, filename: "../work.png" }),
    ).toThrow(ValidationError);
  });
  test("MCP intents have one canonical operation", () => {
    const names = Object.values(operations).flatMap((o) =>
      "mcp" in o ? [o.mcp.name] : [],
    );
    expect(new Set(names).size).toBe(names.length);
    expect(operations.publishWork.idempotent).toBe(true);
    expect(operations.getOwnedWork.cache).toBe("private");
    expect(operations.getWork.cache).toBe("public");
  });
});

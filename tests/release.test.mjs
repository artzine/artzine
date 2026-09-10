import { createHash } from "node:crypto";
import { expect, test } from "vitest";
import { verifyArtifacts } from "../scripts/distribute-release.mjs";

function fixture() {
  const artifacts = new Map();
  const packages = ["contracts", "sdk"].map((name) => {
    const bytes = Buffer.from(`synthetic-${name}`);
    artifacts.set(`@artzine/${name}`, bytes);
    return {
      name: `@artzine/${name}`,
      version: "0.1.0",
      file: `artzine-${name}-0.1.0.tgz`,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
      files: ["package/LICENSE"],
    };
  });
  return {
    artifacts,
    manifest: {
      version: "0.1.0",
      source_commit: "a".repeat(40),
      source_dirty: false,
      publishable: true,
      packaging: {
        node: "v22.23.2",
        platform: "linux",
        arch: "x64",
        pnpm: "10.33.2",
      },
      packages,
    },
  };
}

test("distribution refuses changed bytes and mixed versions before publication", () => {
  const { manifest, artifacts } = fixture();
  verifyArtifacts(manifest, artifacts);
  const original = artifacts.get("@artzine/sdk");
  artifacts.set("@artzine/sdk", Buffer.from("x".repeat(original.length)));
  expect(() => verifyArtifacts(manifest, artifacts)).toThrow();
  artifacts.set("@artzine/sdk", original);
  manifest.packages[1].version = "0.2.0";
  expect(() => verifyArtifacts(manifest, artifacts)).toThrow();
});

test("distribution refuses an incomplete set, escaped filenames and dirty source", () => {
  for (const change of [
    (m) => {
      m.packages.pop();
    },
    (m) => {
      m.packages[0].file = "../other.tgz";
    },
    (m) => {
      m.source_dirty = true;
    },
    (m) => {
      m.publishable = false;
    },
    (m) => {
      m.packages[0].files = [];
    },
  ]) {
    const { manifest, artifacts } = fixture();
    change(manifest);
    expect(() => verifyArtifacts(manifest, artifacts)).toThrow();
  }
});

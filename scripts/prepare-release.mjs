import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyConsumer } from "./verify-package-consumer.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(root, ".artifacts/release");
const folders = ["contracts", "packages/sdk"];
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const packages = [];
let version;
for (const folder of folders) {
  const cwd = resolve(root, folder),
    pkg = JSON.parse(await readFile(resolve(cwd, "package.json"), "utf8"));
  version ??= pkg.version;
  if (pkg.version !== version) throw new Error("Package versions differ.");
  const result = JSON.parse(
    execFileSync("pnpm", ["pack", "--pack-destination", output, "--json"], {
      cwd,
      encoding: "utf8",
    }),
  );
  const file = result.tarballPath ?? result.filename;
  if (!file) throw new Error("Packing did not identify a tarball.");
  const path = resolve(cwd, file),
    bytes = await readFile(path);
  const files = execFileSync("tar", ["-tzf", path], { encoding: "utf8" })
    .trim()
    .split("\n");
  if (
    files.some(
      (f) =>
        !/^package\/(?:dist\/|package\.json$|README\.md$|LICENSE$|CHANGELOG\.md$|media\.json$|entitlements\.json$)/.test(
          f,
        ),
    )
  )
    throw new Error(`Unexpected packed files: ${pkg.name}`);
  packages.push({
    name: pkg.name,
    version: pkg.version,
    file: path.split("/").at(-1),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
    bytes: bytes.length,
    files,
  });
}
const consumer = await verifyConsumer(
  packages.map((p) => resolve(output, p.file)),
  output,
);
const digestInput = await readFile(
  resolve(root, "contracts/dist/generated/operations.js"),
  "utf8",
);
const digest = digestInput.match(/sha256:[a-f0-9]{64}/)?.[0];
if (!digest) throw new Error("Missing contract digest.");
const dirty =
  execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
    cwd: root,
    encoding: "utf8",
  }).trim().length > 0;
const manifest = {
  version,
  source_commit: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim(),
  source_dirty: dirty,
  publishable:
    !dirty &&
    process.version === "v22.23.2" &&
    process.platform === "linux" &&
    process.arch === "x64",
  packaging: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    pnpm: "10.33.2",
  },
  contract_digest: digest,
  lockfile_sha256: createHash("sha256")
    .update(await readFile(resolve(root, "pnpm-lock.yaml")))
    .digest("hex"),
  consumer,
  packages,
};
await writeFile(
  resolve(output, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(
  `Prepared ${packages.length} verified package artifacts; publishable=${manifest.publishable}.`,
);

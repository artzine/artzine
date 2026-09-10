import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyConsumer } from "./verify-package-consumer.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const directory = resolve(root, ".artifacts/release");
const registry = "https://registry.npmjs.org";
const names = ["@artzine/contracts", "@artzine/sdk"];
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const integrity = (bytes) =>
  `sha512-${createHash("sha512").update(bytes).digest("base64")}`;

export function verifyArtifacts(manifest, artifacts) {
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.deepEqual(
    manifest.packages.map((p) => p.name),
    names,
  );
  assert.equal(manifest.publishable, true);
  assert.deepEqual(manifest.packaging, {
    node: "v22.23.2",
    platform: "linux",
    arch: "x64",
    pnpm: "10.33.2",
  });
  assert.equal(manifest.source_dirty, false);
  assert.match(manifest.source_commit, /^[a-f0-9]{40}$/);
  for (const p of manifest.packages) {
    assert.equal(p.version, manifest.version);
    assert.equal(
      p.file,
      `artzine-${p.name.split("/")[1]}-${manifest.version}.tgz`,
    );
    const bytes = artifacts.get(p.name);
    assert.ok(bytes && bytes.length === p.bytes);
    assert.equal(sha(bytes), p.sha256);
    assert.equal(integrity(bytes), p.integrity);
    assert.ok(p.files.includes("package/LICENSE"));
  }
}

async function get(url, maximum) {
  const target = new URL(url);
  assert.equal(target.origin, registry);
  assert.equal(target.username + target.password, "");
  const response = await fetch(target, {
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (response.status === 404) {
    await response.body?.cancel();
    return null;
  }
  assert.equal(response.status, 200, "Registry readback failed");
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    assert.ok(size <= maximum, "Registry response exceeds its limit");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function existing(p, verifyBytes = true) {
  const bytes = await get(
    `${registry}/${encodeURIComponent(p.name)}/${p.version}`,
    1024 * 1024,
  );
  if (bytes === null) return false;
  const remote = JSON.parse(bytes);
  assert.equal(remote.name, p.name);
  assert.equal(remote.version, p.version);
  assert.equal(
    remote.dist.integrity,
    p.integrity,
    "Published version contains different bytes",
  );
  if (verifyBytes) {
    const tarball = await get(remote.dist.tarball, p.bytes);
    assert.ok(tarball && tarball.length === p.bytes);
    assert.equal(integrity(tarball), p.integrity);
    assert.equal(sha(tarball), p.sha256);
  }
  return true;
}

async function main() {
  const action = process.argv[2];
  assert.ok(
    ["candidate", "verify", "promote"].includes(action),
    "Use candidate, verify or promote",
  );
  const bytes = await readFile(resolve(directory, "manifest.json"));
  const manifest = JSON.parse(bytes);
  // Check filenames before opening an artifact; the manifest is never a path grant.
  assert.deepEqual(
    manifest.packages.map((p) => p.name),
    names,
  );
  const artifacts = new Map();
  for (const p of manifest.packages) {
    assert.match(p.file, /^artzine-(contracts|sdk)-\d+\.\d+\.\d+\.tgz$/);
    artifacts.set(p.name, await readFile(resolve(directory, p.file)));
  }
  verifyArtifacts(manifest, artifacts);
  const git = (args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  assert.equal(git(["rev-parse", "HEAD"]), manifest.source_commit);
  assert.equal(
    git(["status", "--porcelain", "--untracked-files=all"]),
    "",
    "Release requires clean source",
  );
  assert.equal(
    sha(await readFile(resolve(root, "pnpm-lock.yaml"))),
    manifest.lockfile_sha256,
  );
  const observed = new Map();
  // Refuse all known conflicts before the first publication or tag mutation.
  for (const p of manifest.packages) observed.set(p.name, await existing(p));
  const manifestDigest = sha(bytes);
  const record = {
    manifest_sha256: manifestDigest,
    version: manifest.version,
    source_commit: manifest.source_commit,
  };
  if (action === "verify") {
    assert.ok(
      [...observed.values()].every(Boolean),
      "A package is missing from the registry",
    );
    const consumer = await verifyConsumer(
      manifest.packages.map((p) => `${p.name}@${p.version}`),
    );
    await writeFile(
      resolve(directory, "registry-verification.json"),
      `${JSON.stringify({ ...record, status: "passed", observed_at: new Date().toISOString(), consumer }, null, 2)}\n`,
    );
    console.log(JSON.stringify({ ...record, status: "verified", consumer }));
    return;
  }
  if (action === "promote") {
    const verified = JSON.parse(
      await readFile(resolve(directory, "registry-verification.json"), "utf8"),
    );
    assert.equal(verified.status, "passed");
    assert.equal(verified.manifest_sha256, manifestDigest);
    assert.ok([...observed.values()].every(Boolean));
  }
  const configDirectory = await mkdtemp(resolve(tmpdir(), "artzine-registry-"));
  const config = resolve(configDirectory, ".npmrc");
  try {
    assert.ok(
      process.env.NODE_AUTH_TOKEN || process.env.NPM_TOKEN,
      "Registry authentication is missing",
    );
    await writeFile(
      config,
      `registry=${registry}\n//registry.npmjs.org/:_authToken=\${NODE_AUTH_TOKEN}\n`,
      { mode: 0o600 },
    );
    const npm = (args) =>
      execFileSync(
        "npm",
        [...args, "--userconfig", config, `--registry=${registry}`],
        {
          cwd: root,
          stdio: "pipe",
          timeout: 180000,
          env: {
            ...process.env,
            NODE_AUTH_TOKEN:
              process.env.NODE_AUTH_TOKEN || process.env.NPM_TOKEN,
          },
        },
      );
    npm(["whoami"]);
    const completed = [];
    for (const p of manifest.packages) {
      if (action === "candidate" && !observed.get(p.name)) {
        try {
          npm([
            "publish",
            resolve(directory, p.file),
            "--tag",
            "next",
            "--access",
            "public",
            "--ignore-scripts",
          ]);
        } catch {
          assert.ok(
            await existing(p),
            `Publication of ${p.name} is unconfirmed; reconcile before retrying`,
          );
        }
        assert.ok(await existing(p));
      }
      const tag = action === "promote" ? "latest" : "next";
      npm(["dist-tag", "add", `${p.name}@${p.version}`, tag]);
      const tagged = JSON.parse(
        await get(
          `${registry}/${encodeURIComponent(p.name)}/${tag}`,
          1024 * 1024,
        ),
      );
      assert.equal(tagged.version, p.version);
      assert.equal(tagged.dist.integrity, p.integrity);
      completed.push(p.name);
      await writeFile(
        resolve(directory, `${action}-readback.json`),
        `${JSON.stringify({ ...record, tag, completed, observed_at: new Date().toISOString() }, null, 2)}\n`,
      );
    }
    console.log(
      JSON.stringify({
        ...record,
        status: action === "candidate" ? "published_candidate" : "promoted",
        packages: completed,
      }),
    );
  } finally {
    await rm(configDirectory, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(
      error.code === "ERR_ASSERTION"
        ? error.message
        : "Package distribution failed; inspect the retained manifest and registry state before retrying.",
    );
    process.exitCode = 1;
  });
}

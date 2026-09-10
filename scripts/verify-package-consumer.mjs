import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../", import.meta.url));
export async function verifyConsumer(specs, output) {
  const directory = await mkdtemp(resolve(tmpdir(), "artzine-consumer-"));
  try {
    await writeFile(
      resolve(directory, "package.json"),
      JSON.stringify({
        name: "artzine-package-consumer",
        private: true,
        type: "module",
      }),
    );
    execFileSync(
      "npm",
      [
        "install",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--registry=https://registry.npmjs.org",
        ...specs,
      ],
      { cwd: directory, stdio: "pipe", timeout: 180000 },
    );
    for (const [from, to] of [
      ["packed-consumer.mjs", "smoke.mjs"],
      ["typed-consumer.ts", "consumer.ts"],
    ]) {
      await cp(resolve(root, "tests/fixtures", from), resolve(directory, to));
    }
    execFileSync(process.execPath, ["smoke.mjs"], {
      cwd: directory,
      stdio: "inherit",
      timeout: 30000,
    });
    for (const [module, resolution] of [
      ["NodeNext", "NodeNext"],
      ["ESNext", "Bundler"],
    ]) {
      execFileSync(
        process.execPath,
        [
          resolve(root, "node_modules/typescript/bin/tsc"),
          "--noEmit",
          "--strict",
          "--skipLibCheck",
          "--target",
          "ES2022",
          "--module",
          module,
          "--moduleResolution",
          resolution,
          "consumer.ts",
        ],
        { cwd: directory, stdio: "pipe", timeout: 30000 },
      );
    }
    const bundled = await build({
      absWorkingDir: directory,
      entryPoints: ["consumer.ts"],
      bundle: true,
      platform: "browser",
      format: "iife",
      globalName: "artzineConsumer",
      write: false,
      minify: true,
      metafile: true,
    });
    assert.ok(
      Object.values(bundled.metafile.outputs).every(
        (entry) => entry.imports.length === 0,
      ),
    );
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.route("**/*", (route) => route.abort());
      await page.setContent("<!doctype html><title>Package consumer</title>");
      await page.addScriptTag({ content: bundled.outputFiles[0].text });
      const digest = await page.evaluate(() =>
        globalThis.artzineConsumer.checkConsumer(),
      );
      assert.match(digest, /^sha256:[a-f0-9]{64}$/);
    } finally {
      await browser.close();
    }
    if (output)
      await cp(
        resolve(directory, "package-lock.json"),
        resolve(output, "consumer-package-lock.json"),
      );
    return {
      node: true,
      typescript: ["NodeNext", "Bundler"],
      browser: "chromium",
      browser_bytes: bundled.outputFiles[0].contents.length,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

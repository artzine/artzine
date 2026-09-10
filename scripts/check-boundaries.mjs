import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const packages = { contracts: [], "packages/sdk": ["@artzine/contracts"] };
const errors = [];
for (const [folder, allowed] of Object.entries(packages)) {
  const graph = new Map();
  async function visit(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        await visit(path);
        continue;
      }
      if (
        !path.endsWith(".ts") ||
        path.endsWith(".d.ts") ||
        path.includes("/generated/")
      )
        continue;
      const content = await readFile(path, "utf8");
      const imports = [
        ...content.matchAll(/(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g),
      ].map((m) => m[1]);
      const edges = [];
      for (const specifier of imports) {
        if (specifier.startsWith(".")) {
          const target = resolve(dir, specifier.replace(/\.js$/, ".ts"));
          if (!target.startsWith(`${resolve(root, folder, "src")}/`))
            errors.push(`Source escape: ${relative(root, path)}`);
          edges.push(target);
        } else if (
          !allowed.some(
            (name) => specifier === name || specifier.startsWith(`${name}/`),
          )
        )
          errors.push(
            `Undeclared dependency ${specifier}: ${relative(root, path)}`,
          );
      }
      graph.set(path, edges);
    }
  }
  await visit(resolve(root, folder, "src"));
  const active = new Set(),
    done = new Set();
  function walk(node) {
    if (active.has(node)) {
      errors.push(`Import cycle: ${relative(root, node)}`);
      return;
    }
    if (done.has(node)) return;
    active.add(node);
    for (const target of graph.get(node) ?? []) walk(target);
    active.delete(node);
    done.add(node);
  }
  for (const node of graph.keys()) walk(node);
  const manifest = JSON.parse(
    await readFile(resolve(root, folder, "package.json"), "utf8"),
  );
  if (
    !manifest.exports ||
    !manifest.files?.includes("dist") ||
    manifest.sideEffects !== false
  )
    errors.push(`Incomplete package boundary: ${folder}`);
}
if (errors.length) throw new Error(errors.join("\n"));
console.log("Package dependency directions and import cycles passed.");

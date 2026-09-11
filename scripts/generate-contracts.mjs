import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import Ajv from "ajv/dist/2020.js";
import standaloneCode from "ajv/dist/standalone/index.js";
import addFormats from "ajv-formats";
import { build } from "esbuild";
import openapiTS, { astToString } from "openapi-typescript";
import { parse } from "yaml";

const root = fileURLToPath(new URL("../", import.meta.url));
const check = process.argv.includes("--check");
const names = ["openapi.yaml", "media.json", "entitlements.json"];
const bytes = await Promise.all(
  names.map((name) => readFile(`${root}contracts/${name}`, "utf8")),
);
const api = parse(bytes[0]);
const workPresets = Object.keys(JSON.parse(bytes[1]).presets).sort();
const collectionPresets = [
  ...api.components.schemas.CollectionDraft.properties.preset.enum,
].sort();
for (const name of ["Work", "WorkDraft"]) {
  const declared = api.components.schemas[name].properties.preset.enum;
  if (JSON.stringify([...declared].sort()) !== JSON.stringify(workPresets))
    throw new Error(`Media registry/preset schema drift: ${name}`);
}
function checkPresets(schema, path) {
  if (!schema || typeof schema !== "object") return;
  const preset = schema.properties?.preset?.enum;
  if (preset) {
    const expected = preset.every((id) => id.startsWith("zine."))
      ? collectionPresets
      : preset.some((id) => id.startsWith("zine."))
        ? [...workPresets, ...collectionPresets].sort()
        : workPresets;
    if (JSON.stringify([...preset].sort()) !== JSON.stringify(expected))
      throw new Error(`Preset projection drift: ${path}`);
  }
  for (const [name, child] of Object.entries(schema))
    if (child && typeof child === "object")
      checkPresets(child, `${path}.${name}`);
}
checkPresets(api, "openapi");
if (
  api.components.schemas.OwnedProfile.properties.retained_handles.maxItems !==
  JSON.parse(bytes[2]).plans.free.profile_handles
)
  throw new Error("Profile address bound differs from its entitlement");
if (
  api.components.schemas.Profile.properties.collections.maxItems !==
  JSON.parse(bytes[2]).plans.free.public_collections
)
  throw new Error("Profile collection bound differs from its entitlement");
const digest = `sha256:${createHash("sha256")
  .update(names.map((name, i) => `${name}\0${bytes[i]}\0`).join(""))
  .digest("hex")}`;
const ajv = new Ajv({
  strict: false,
  allErrors: true,
  inlineRefs: false,
  code: { source: true, esm: true },
});
addFormats(ajv);
const schemas = JSON.parse(
  JSON.stringify(api.components.schemas).replaceAll(
    "#/components/schemas/",
    "#/$defs/",
  ),
);
ajv.addSchema({ $id: "artzine", $defs: schemas });
const exports = {};
for (const name of Object.keys(schemas)) {
  const key = `artzine#/$defs/${name}`;
  ajv.getSchema(key);
  exports[`validate${name}`] = key;
}
const operations = {};
for (const [path, methods] of Object.entries(api.paths)) {
  for (const [method, operation] of Object.entries(methods)) {
    if (operations[operation.operationId])
      throw new Error("Duplicate operation ID");
    const meta = operation["x-artzine"];
    if (
      !meta ||
      !schemas[meta.input] ||
      !schemas[meta.output] ||
      !(
        meta.scope === null ||
        (typeof meta.scope === "string" && meta.scope.length > 0)
      )
    )
      throw new Error(`Incomplete contract: ${path}`);
    const input = api.components.schemas[meta.input];
    const projected = {
      ...(operation.requestBody?.content["application/json"].schema
        .properties ?? {}),
    };
    const required = new Set(
      operation.requestBody?.content["application/json"].schema.required ?? [],
    );
    for (const p of operation.parameters ?? [])
      if (p.in !== "header") {
        projected[p.name] = p.schema;
        if (p.required) required.add(p.name);
      }
    if (
      JSON.stringify(Object.entries(projected).sort()) !==
        JSON.stringify(Object.entries(input.properties).sort()) ||
      JSON.stringify([...required].sort()) !==
        JSON.stringify([...input.required].sort())
    )
      throw new Error(`Wire/input schema drift: ${operation.operationId}`);
    operations[operation.operationId] = {
      method: method.toUpperCase(),
      path,
      ...meta,
      summary: operation.summary,
    };
  }
}
const consumerAjv = new Ajv({
  strict: false,
  allErrors: true,
  inlineRefs: false,
  code: { source: true, esm: true },
});
addFormats(consumerAjv);
function resolvedSchema(schema) {
  if (!schema.$ref) return schema;
  return schema.$ref
    .slice(2)
    .split("/")
    .reduce((value, key) => value[key], { $defs: schemas });
}
function consumerProjection(key, value) {
  if (
    ["additionalProperties", "unevaluatedProperties"].includes(key) &&
    value === false
  )
    return true;
  if (!["anyOf", "oneOf"].includes(key)) return value;
  // A field belonging to another known object variant is not an unknown
  // extension. Preserve the closed union's branch boundaries when opening it.
  const branches = value.map(resolvedSchema);
  const known = new Set(
    branches.flatMap((s) => Object.keys(s.properties ?? {})),
  );
  return value.map((branch, i) => {
    const schema = branches[i];
    if (schema.type !== "object" || schema.additionalProperties !== false)
      return branch;
    const excluded = [...known].filter(
      (name) => !Object.hasOwn(schema.properties ?? {}, name),
    );
    return excluded.length
      ? {
          allOf: [
            branch,
            { not: { anyOf: excluded.map((name) => ({ required: [name] })) } },
          ],
        }
      : branch;
  });
}
const consumerSchemas = JSON.parse(JSON.stringify(schemas, consumerProjection));
consumerAjv.addSchema({ $id: "artzine-consumer", $defs: consumerSchemas });
const consumerNames = [
  ...new Set([
    ...Object.values(operations).map((o) => o.output),
    "ErrorEnvelope",
  ]),
].sort();
const consumerExports = {};
for (const name of consumerNames) {
  const key = `artzine-consumer#/$defs/${name}`;
  consumerAjv.getSchema(key);
  consumerExports[`validate${name}`] = key;
}
const banner = `// Generated by scripts/generate-contracts.mjs (generator 3). Source ${digest}. Do not edit.\n`;
const types = astToString(await openapiTS(api));
const map = Object.entries(operations)
  .map(
    ([id, op]) =>
      `  ${id}: { input: components['schemas']['${op.input}']; output: components['schemas']['${op.output}'] };`,
  )
  .join("\n");
const registry = `${banner}import type { components } from './types.js';\nexport const contractDigest = ${JSON.stringify(digest)};\nexport const contractVersion = ${JSON.stringify(api.info.version)};\nexport const operations = ${JSON.stringify(operations, null, 2)} as const;\nexport type OperationMap = {\n${map}\n};\n`;
const validationDeclarations = `${banner}type Validator = ((data: unknown) => boolean) & { errors?: readonly { instancePath: string; message?: string }[] | null };\n${Object.keys(
  schemas,
)
  .map((name) => `export const validate${name}: Validator;`)
  .join("\n")}\n`;
const docs = `# API reference\n\nGenerated from the canonical contract. Version ${api.info.version}; digest \`${digest}\`.\n\n| Operation | HTTP | Scope | MCP |\n| --- | --- | --- | --- |\n${Object.entries(
  operations,
)
  .map(
    ([id, o]) =>
      `| ${id} | ${o.method} ${o.path} | ${o.scope ?? "Public"} | ${o.mcp?.name ?? ""} |`,
  )
  .join("\n")}\n`;
const validatorMap = `${banner}import { ${Object.keys(schemas)
  .map((n) => `validate${n}`)
  .join(", ")} } from './validators.js';
export const validators = { ${Object.keys(schemas)
  .map((n) => `${n}: validate${n}`)
  .join(", ")} };
`;
const outputs = {
  "contracts/src/generated/consumer-map.ts": `${banner}import { ${consumerNames.map((n) => `validate${n}`).join(", ")} } from './consumer-validators.js';\nexport const consumerValidators = { ${consumerNames.map((n) => `${n}: validate${n}`).join(", ")} };\n`,
  "contracts/src/generated/consumer-validators.d.ts": `${banner}${consumerNames.map((n) => `export const validate${n}: (value: unknown) => boolean;`).join("\n")}\n`,
  "contracts/src/generated/consumer-validators.js":
    banner +
    (
      await build({
        absWorkingDir: root,
        stdin: {
          contents: standaloneCode(consumerAjv, consumerExports),
          resolveDir: root,
        },
        bundle: true,
        write: false,
        format: "esm",
        platform: "neutral",
        minify: false,
      })
    ).outputFiles[0].text,
  "contracts/src/generated/validator-map.ts": validatorMap,
  "contracts/src/generated/types.ts": banner + types,
  "contracts/src/generated/operations.ts": registry,
  "contracts/src/generated/validators.js":
    banner +
    (
      await build({
        absWorkingDir: root,
        stdin: { contents: standaloneCode(ajv, exports), resolveDir: root },
        bundle: true,
        write: false,
        format: "esm",
        platform: "neutral",
        minify: false,
      })
    ).outputFiles[0].text,
  "contracts/src/generated/validators.d.ts": validationDeclarations,
  "contracts/src/generated/openapi.json": `${JSON.stringify(api, null, 2)}\n`,
  "contracts/src/generated/media.json": bytes[1],
  "contracts/src/generated/entitlements.json": bytes[2],
  "docs/api.md": docs,
};
for (const [path, content] of Object.entries(outputs)) {
  if (check) {
    if ((await readFile(root + path, "utf8").catch(() => "")) !== content)
      throw new Error(`Generated drift: ${path}`);
  } else {
    await mkdir(fileURLToPath(new URL(".", `file://${root}${path}`)), {
      recursive: true,
    });
    await writeFile(root + path, content);
  }
}
console.log(
  `${check ? "Verified" : "Generated"} ${Object.keys(operations).length} operations; ${digest}`,
);

import { copyFile, mkdir } from "node:fs/promises";

await mkdir(new URL("../contracts/dist/generated/", import.meta.url), {
  recursive: true,
});
await copyFile(
  new URL("../contracts/src/generated/openapi.json", import.meta.url),
  new URL("../contracts/dist/generated/openapi.json", import.meta.url),
);

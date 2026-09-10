import {
  type Input,
  type OperationId,
  type Output,
  operations,
  parseInput,
  type Schema,
} from "@artzine/contracts";
import { parseErrorResponse, parseResponse } from "@artzine/contracts/consumer";
export type Result<K extends OperationId> = {
  request_id: string;
  contract_version: string;
  result: Output<K>;
};
export class ArtzineApiError extends Error {
  constructor(
    readonly status: number,
    readonly error: Schema<"Error">,
    readonly requestId: string,
  ) {
    super(error.message);
    this.name = "ArtzineApiError";
  }
}
export type ClientOptions = {
  baseUrl: string;
  token?: string | (() => Promise<string>);
  fetch?: typeof fetch;
};
export type CallOptions = { idempotencyKey?: string; signal?: AbortSignal };
export function createClient(options: ClientOptions) {
  const origin = new URL(options.baseUrl);
  if (
    origin.protocol !== "https:" &&
    !(
      origin.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
    )
  )
    throw new Error("Use an HTTPS API origin.");
  const send = options.fetch ?? globalThis.fetch;
  async function call<K extends OperationId>(
    operation: K,
    value: Input<K>,
    context: CallOptions = {},
  ): Promise<Result<K>> {
    const input = parseInput(operation, value);
    const meta = operations[operation];
    const headers = new Headers({ Accept: "application/json" });
    if (meta.idempotent) {
      if (!context.idempotencyKey)
        throw new Error("Supply an idempotency key for this mutation.");
      headers.set("Idempotency-Key", context.idempotencyKey);
    }
    const token =
      typeof options.token === "function"
        ? await options.token()
        : options.token;
    if (token) headers.set("Authorization", `Bearer ${token}`);
    let path: string = meta.path;
    const rest: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (path.includes(`{${key}}`))
        path = path.replace(`{${key}}`, encodeURIComponent(String(value)));
      else if (value !== undefined) rest[key] = value;
    }
    const url = new URL(path, origin);
    if (meta.method === "GET")
      for (const [key, value] of Object.entries(rest))
        url.searchParams.set(key, String(value));
    const init: RequestInit = {
      method: meta.method,
      headers,
      credentials: "include",
      ...(context.signal ? { signal: context.signal } : {}),
    };
    if (meta.method !== "GET") {
      headers.set("Content-Type", "application/json");
      init.body = JSON.stringify(rest);
    }
    const response = await send(url, init);
    const payload: unknown = await response.json();
    if (!response.ok) {
      const error = parseErrorResponse(payload);
      throw new ArtzineApiError(response.status, error.error, error.request_id);
    }
    if (
      !payload ||
      typeof payload !== "object" ||
      !("request_id" in payload) ||
      !("contract_version" in payload) ||
      !("result" in payload) ||
      typeof payload.request_id !== "string" ||
      typeof payload.contract_version !== "string"
    )
      throw new Error("Invalid API response envelope.");
    return {
      request_id: payload.request_id,
      contract_version: payload.contract_version,
      result: parseResponse(operation, payload.result),
    };
  }
  return { call };
}
export type ArtzineClient = ReturnType<typeof createClient>;
/** Transfer only the selected file to the issued S3 form, without API credentials. */
export async function uploadDirect(
  grant: Schema<"UploadGrant">,
  file: Blob,
  options: { fetch?: typeof fetch; signal?: AbortSignal } = {},
): Promise<{ sourceVersion: string }> {
  const url = new URL(grant.url);
  if (
    url.protocol !== "https:" ||
    !/^.+\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/.test(url.hostname)
  )
    throw new Error("The upload grant must target S3.");
  if (Date.parse(grant.expires_at) <= Date.now())
    throw new Error("The upload grant has expired.");
  if (file.size > grant.max_bytes)
    throw new Error("The file exceeds the upload limit.");
  const form = new FormData();
  for (const [key, value] of Object.entries(grant.fields))
    form.append(key, value);
  form.append("file", file);
  const response = await (options.fetch ?? globalThis.fetch)(url, {
    method: "POST",
    body: form,
    credentials: "omit",
    ...(options.signal ? { signal: options.signal } : {}),
  });
  if (!response.ok)
    throw new Error(
      `The upload failed (${response.status}). Request another grant to retry.`,
    );
  const sourceVersion = response.headers.get("x-amz-version-id");
  if (!sourceVersion || sourceVersion === "null")
    throw new Error(
      "S3 did not return a version ID. The upload cannot be completed.",
    );
  return { sourceVersion };
}

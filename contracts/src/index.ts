import entitlements from "./generated/entitlements.json" with { type: "json" };
import media from "./generated/media.json" with { type: "json" };
import type { OperationMap } from "./generated/operations.js";
import { operations } from "./generated/operations.js";
import type { components } from "./generated/types.js";
import { validators } from "./generated/validator-map.js";

export {
  contractDigest,
  contractVersion,
  operations,
} from "./generated/operations.js";
export type { components, paths } from "./generated/types.js";
export type { OperationMap };
export { entitlements, media };
export type OperationId = keyof OperationMap;
export type Input<K extends OperationId> = OperationMap[K]["input"];
export type Output<K extends OperationId> = OperationMap[K]["output"];
export type Schema<N extends keyof components["schemas"]> =
  components["schemas"][N];
export class ValidationError extends Error {
  constructor(readonly schema: string) {
    super(`Invalid ${schema}`);
    this.name = "ValidationError";
  }
}
export function parseSchema<N extends keyof components["schemas"]>(
  name: N,
  value: unknown,
): Schema<N> {
  const validate = validators[name];
  if (!validate(value)) throw new ValidationError(name);
  return value as Schema<N>;
}
export function parseInput<K extends OperationId>(
  operation: K,
  value: unknown,
): Input<K> {
  return parseSchema(operations[operation].input, value) as Input<K>;
}
export function parseOutput<K extends OperationId>(
  operation: K,
  value: unknown,
): Output<K> {
  return parseSchema(operations[operation].output, value) as Output<K>;
}
export function isOperationId(value: string): value is OperationId {
  return Object.hasOwn(operations, value);
}

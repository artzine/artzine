import { consumerValidators } from "./generated/consumer-map.js";
import { operations } from "./generated/operations.js";
import {
  type OperationId,
  type Output,
  type Schema,
  ValidationError,
} from "./index.js";

/** Validate known response fields while accepting additive object properties. */
export function parseResponse<K extends OperationId>(
  operation: K,
  value: unknown,
): Output<K> {
  const name = operations[operation].output;
  if (!consumerValidators[name](value)) throw new ValidationError(name);
  return value as Output<K>;
}

export function parseErrorResponse(value: unknown): Schema<"ErrorEnvelope"> {
  if (!consumerValidators.ErrorEnvelope(value))
    throw new ValidationError("ErrorEnvelope");
  return value as Schema<"ErrorEnvelope">;
}

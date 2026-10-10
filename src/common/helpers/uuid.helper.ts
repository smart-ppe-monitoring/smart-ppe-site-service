import { uuidv7 } from "uuidv7";

/**
 * Generate a UUID v7 (time-ordered UUID).
 * UUIDv7 encodes a Unix timestamp in the most-significant bits,
 * making it monotonically sortable and friendlier to B-tree indexes.
 */
export { uuidv7 };

/** Alias: generate a new UUID v7 */
export const generateId = uuidv7;

/**
 * Regex matching standard 36-character hyphenated UUID strings (v1-v7).
 */
export const UUID_REGEX = /^[0-9a-fA-F-]{36}$/;

/**
 * Type guard verifying if an unknown value is a 36-character hyphenated UUID string.
 */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

import { z } from "zod";

/**
 * Standard reusable UUID validation schema
 */
export const uuidSchema = z
  .string({
    required_error: "ID is required",
    invalid_type_error: "ID must be a string",
  })
  .uuid("Invalid UUID format");

/**
 * Factory for creating reusable single-parameter UUID schemas
 * E.g. uuidParamSchema("id") -> z.object({ id: z.string().uuid(...) })
 */
export function createUuidParamSchema<K extends string = "id">(
  paramName: K = "id" as K,
  errorMessage: string = `Invalid ${paramName} format`,
) {
  return z.object({
    [paramName]: z
      .string({
        required_error: `${paramName} is required`,
        invalid_type_error: `${paramName} must be a string`,
      })
      .uuid(errorMessage),
  } as Record<K, z.ZodString>);
}

/**
 * Default standard param schema for :id
 */
export const standardIdParamSchema = createUuidParamSchema(
  "id",
  "Invalid ID format",
);

/**
 * Standard reusable pagination query schema
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * Standard Route Key validation schema for system settings, feature flags, configuration keys
 */
export const routeKeySchema = z
  .string({
    required_error: "Key is required",
    invalid_type_error: "Key must be a string",
  })
  .min(2, "Key must be at least 2 characters")
  .max(100, "Key must not exceed 100 characters")
  .regex(
    /^[a-z0-9_.-]+$/i,
    "Key must contain only letters, numbers, dots, hyphens, and underscores",
  );

/**
 * Factory for creating reusable single-parameter Route Key schemas
 * E.g. createRouteKeyParamSchema("key") -> z.object({ key: routeKeySchema })
 */
export function createRouteKeyParamSchema<K extends string = "key">(
  paramName: K = "key" as K,
) {
  return z.object({
    [paramName]: routeKeySchema,
  } as Record<K, typeof routeKeySchema>);
}

/**
 * Default standard param schema for :key
 */
export const standardKeyParamSchema = createRouteKeyParamSchema("key");

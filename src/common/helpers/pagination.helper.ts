import { PaginationMeta } from "../types/pagination.type";

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_PAGINATION_LIMIT = 100;

/**
 * Standardize 1-indexed pagination parameters:
 * - page: integer >= 1 (defaults to 1)
 * - limit: integer between 1 and 100 (defaults to 20, max 100)
 */
export function calculatePaginationSkip(
  pageInput?: number,
  limitInput?: number,
  defaultLimit = DEFAULT_LIMIT,
): {
  skip: number;
  take: number;
  page: number;
  limit: number;
} {
  const page = Math.max(1, Math.floor(Number(pageInput) || DEFAULT_PAGE));
  const rawLimit = Math.floor(Number(limitInput) || defaultLimit);
  const limit = Math.min(MAX_PAGINATION_LIMIT, Math.max(1, rawLimit));
  const skip = (page - 1) * limit;

  return { skip, take: limit, page, limit };
}

/**
 * Format PaginationMeta object with (page, limit, total, totalPages)
 */
export function formatPaginationMeta(
  page: number,
  limit: number,
  total: number,
): PaginationMeta {
  const safePage = Math.max(1, page || DEFAULT_PAGE);
  const safeLimit = Math.min(
    MAX_PAGINATION_LIMIT,
    Math.max(1, limit || DEFAULT_LIMIT),
  );
  return {
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: safeLimit > 0 ? Math.ceil(total / safeLimit) : 0,
  };
}

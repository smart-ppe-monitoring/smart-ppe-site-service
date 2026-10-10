/**
 * Standard pagination metadata representation across all API responses
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Standard paginated collection envelope
 */
export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Reliability & Idempotency Domain Constants (Task BE-13)
 *
 * Định nghĩa hằng số quản lý chính sách Idempotency, Concurrency Mutex Lock,
 * Exponential Backoff Retry và phân loại lỗi hệ thống.
 */

export const IDEMPOTENCY_STATUS = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  DUPLICATE_REJECTED: "DUPLICATE_REJECTED",
} as const;

export type IdempotencyStatus = keyof typeof IDEMPOTENCY_STATUS;

export const IDEMPOTENCY_REASON = {
  EXACT_EVENT_ID: "EXACT_EVENT_ID",
  EXACT_VIOLATION_ID: "EXACT_VIOLATION_ID",
  BUSINESS_FINGERPRINT_COOLDOWN: "BUSINESS_FINGERPRINT_COOLDOWN",
  STORAGE_CONSTRAINT: "STORAGE_CONSTRAINT",
  IN_FLIGHT_CONCURRENCY: "IN_FLIGHT_CONCURRENCY",
} as const;

export type IdempotencyReason = keyof typeof IDEMPOTENCY_REASON;

export const RETRY_POLICY = {
  DEFAULT_MAX_ATTEMPTS: 3,
  INITIAL_BACKOFF_MS: 100,
  MAX_BACKOFF_MS: 3000,
  BACKOFF_MULTIPLIER: 2,
  JITTER_FACTOR: 0.2,
  LOCK_TIMEOUT_MS: 10000, // 10 giây tự giải phóng lock chống deadlock
  DEFAULT_COOLDOWN_WINDOW_MS: 15000, // 15 giây cho Business Fingerprint chống AI frame jitter
  IDEMPOTENCY_TTL_MS: 86400000, // 24 giờ lưu trữ khóa trong cache
} as const;

export const ERROR_CATEGORY = {
  TRANSIENT: "TRANSIENT", // Lỗi tạm thời (DB connection timeout, deadlock 40P01, 503) -> Retryable
  PERMANENT: "PERMANENT", // Lỗi vĩnh viễn (Schema validation failure, invalid UUID, 400, 404) -> Poison pill, DLQ immediately
} as const;

export type ErrorCategory = keyof typeof ERROR_CATEGORY;

export const RELIABILITY_LIMITS = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  MAX_STORED_KEYS: 20000,
} as const;

export const TRACE_STAGE = {
  DEAD_LETTER_QUEUE: "DEAD_LETTER_QUEUE",
  IDEMPOTENCY_MUTEX: "IDEMPOTENCY_MUTEX",
  AUDIT_LOG: "AUDIT_LOG",
} as const;

export type TraceStage = keyof typeof TRACE_STAGE;

export const TRACE_STAGE_STATUS = {
  PENDING: "PENDING",
  RECORDED: "RECORDED",
} as const;

export type TraceStageStatus = keyof typeof TRACE_STAGE_STATUS;

import { AppError } from "./app-error";
import { ERROR_CODE, ErrorCode } from "./error-code";

/**
 * Lỗi yêu cầu không hợp lệ (HTTP 400 Bad Request).
 */
export class BadRequestError extends AppError {
  constructor(message: string = "Bad Request", code: ErrorCode = ERROR_CODE.BAD_REQUEST, data?: unknown) {
    super(message, 400, code, data);
  }
}

/**
 * Lỗi chưa xác thực (HTTP 401 Unauthorized).
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized", code: ErrorCode = ERROR_CODE.UNAUTHORIZED, data?: unknown) {
    super(message, 401, code, data);
  }
}

/**
 * Lỗi không có quyền truy cập (HTTP 403 Forbidden).
 */
export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden", code: ErrorCode = ERROR_CODE.FORBIDDEN, data?: unknown) {
    super(message, 403, code, data);
  }
}

/**
 * Lỗi tài nguyên không tồn tại (HTTP 404 Not Found).
 */
export class NotFoundError extends AppError {
  constructor(message: string = "Not Found", code: ErrorCode = ERROR_CODE.NOT_FOUND, data?: unknown) {
    super(message, 404, code, data);
  }
}

/**
 * Lỗi xung đột tài nguyên hoặc Idempotency (HTTP 409 Conflict).
 */
export class ConflictError extends AppError {
  constructor(message: string = "Conflict", code: ErrorCode = ERROR_CODE.DUPLICATE_ENTRY, data?: unknown) {
    super(message, 409, code, data);
  }
}

/**
 * Lỗi kiểm tra dữ liệu đầu vào (HTTP 422 Unprocessable Entity / 400).
 */
export class ValidationError extends AppError {
  constructor(message: string = "Validation failed", errors?: unknown) {
    super(message, 422, ERROR_CODE.VALIDATION_ERROR, errors);
  }
}

/**
 * Lỗi vượt quá giới hạn tần suất yêu cầu (HTTP 429 Too Many Requests).
 */
export class TooManyRequestsError extends AppError {
  constructor(message: string = "Too many requests", data?: unknown) {
    super(message, 429, ERROR_CODE.TOO_MANY_REQUESTS, data);
  }
}

/**
 * Lỗi quá hạn thời gian xử lý yêu cầu (HTTP 504 Gateway Timeout).
 */
export class TimeoutError extends AppError {
  constructor(
    message: string = "Request processing timed out",
    code: ErrorCode = ERROR_CODE.REQUEST_TIMEOUT,
    data?: unknown,
  ) {
    super(message, 504, code, data);
  }
}

/**
 * Lỗi cổng kết nối hoặc upstream service không phản hồi (HTTP 502 Bad Gateway).
 */
export class BadGatewayError extends AppError {
  constructor(
    message: string = "Bad Gateway: Upstream service failure",
    code: ErrorCode = ERROR_CODE.BAD_GATEWAY,
    data?: unknown,
  ) {
    super(message, 502, code, data);
  }
}

/**
 * Lỗi dịch vụ tạm thời không khả dụng (HTTP 503 Service Unavailable).
 */
export class ServiceUnavailableError extends AppError {
  constructor(
    message: string = "Service is temporarily unavailable",
    code: ErrorCode = ERROR_CODE.SERVICE_UNAVAILABLE,
    data?: unknown,
  ) {
    super(message, 503, code, data);
  }
}

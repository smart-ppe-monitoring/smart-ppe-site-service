import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import multer from "multer";
import { AppError } from "../common/errors/app-error";
import { ERROR_CODE } from "../common/errors/error-code";

export function notFoundMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // LOW-01 Fix: Dùng req.path thay cho req.originalUrl để không để lộ query params nhạy cảm
  next(
    new AppError(
      `Route ${req.method} ${req.path} not found`,
      404,
      ERROR_CODE.NOT_FOUND,
    ),
  );
}

export function errorMiddleware(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Bắt ZodError tập trung (RFC 7807 / 422)
  if (error instanceof ZodError) {
    const formattedErrors = error.errors.map((e) => ({
      field: e.path.join(".") || "unknown",
      message: e.message,
    }));
    res.status(422).json({
      success: false,
      message: "Validation failed",
      code: ERROR_CODE.VALIDATION_ERROR,
      errors: formattedErrors,
    });
    return;
  }

  if (error instanceof AppError) {
    const payload: Record<string, any> = {
      success: false,
      message: error.message,
      code: error.code,
    };
    if (error.data !== undefined) {
      if (error.code === ERROR_CODE.VALIDATION_ERROR) {
        payload.errors = error.data;
      } else {
        payload.data = error.data;
      }
    }
    res.status(error.statusCode).json(payload);
    return;
  }

  if (
    error instanceof SyntaxError &&
    "status" in error &&
    (error as any).status === 400
  ) {
    res.status(400).json({
      success: false,
      message: "Invalid JSON payload format",
      code: ERROR_CODE.VALIDATION_ERROR,
    });
    return;
  }

  if (error instanceof multer.MulterError) {
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Kích thước tệp tin vượt quá giới hạn tối đa cho phép"
        : `Lỗi tải lên tệp tin: ${error.message}`;
    res.status(400).json({
      success: false,
      message,
      code: ERROR_CODE.VALIDATION_ERROR,
    });
    return;
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    (error as any)?.name === "PrismaClientKnownRequestError"
  ) {
    if ((error as any).code === "P2002") {
      const conflictingFields =
        ((error as any).meta?.target as string[] | undefined) ?? [];
      if (conflictingFields.some((f) => f.toLowerCase().includes("slug"))) {
        res.status(409).json({
          success: false,
          message: "Đường dẫn định danh đã tồn tại. Vui lòng chọn tên khác.",
          code: ERROR_CODE.DUPLICATE_ENTRY,
        });
        return;
      }
      res.status(409).json({
        success: false,
        message:
          "Dữ liệu đã tồn tại trong hệ thống (trùng lặp giá trị duy nhất)",
        code: ERROR_CODE.DUPLICATE_ENTRY,
      });
      return;
    }

    if ((error as any).code === "P2025") {
      res.status(404).json({
        success: false,
        message: "Bản ghi không tồn tại hoặc đã bị xóa",
        code: ERROR_CODE.NOT_FOUND,
      });
      return;
    }

    if ((error as any).code === "P2003" || (error as any).code === "P2014") {
      res.status(400).json({
        success: false,
        message: "Dữ liệu liên kết hoặc ràng buộc quan hệ không hợp lệ",
        code: ERROR_CODE.VALIDATION_ERROR,
      });
      return;
    }
  }

  if (
    error instanceof Prisma.PrismaClientValidationError ||
    (error as any)?.name === "PrismaClientValidationError"
  ) {
    res.status(400).json({
      success: false,
      message: "Dữ liệu truy vấn không hợp lệ",
      code: ERROR_CODE.VALIDATION_ERROR,
    });
    return;
  }

  // LOW-02 Fix: Sanitize request ID chống tấn công log injection / CRLF
  const rawRequestId = req.headers["x-request-id"] as string;
  const requestId =
    rawRequestId && /^[a-zA-Z0-9_-]{1,64}$/.test(rawRequestId)
      ? rawRequestId
      : req.id || "no-request-id";
  console.error(`[Unhandled Error][Request-ID: ${requestId}]`, error);

  res.status(500).json({
    success: false,
    message: "Internal server error",
    code: ERROR_CODE.INTERNAL_SERVER_ERROR,
  });
}

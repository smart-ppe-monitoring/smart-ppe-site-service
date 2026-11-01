import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { jwtConfig } from "../config/jwt.config";
import { AppError } from "../common/errors/app-error";
import { ERROR_CODE } from "../common/errors/error-code";
import { JWT_PURPOSE, JWT_ALGORITHM } from "../common/constants/jwt.constant";
import { hashApiKey } from "../common/helpers/crypto.helper";
import { getSharedRateLimitRedisClient } from "./rate-limit.middleware";

export function extractTokenFromRequest(req: Request): string | undefined {
  let token = req.cookies?.accessToken;
  if (!token) {
    const authHeader = req.headers?.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }
  }
  return token;
}

export type ApiKeyResolver = (key: string) => Promise<{
  user: Express.Request["user"];
  apiKey: NonNullable<Express.Request["apiKey"]>;
} | null> | {
  user: Express.Request["user"];
  apiKey: NonNullable<Express.Request["apiKey"]>;
} | null;

let apiKeyResolver: ApiKeyResolver | null = null;

export function setApiKeyResolver(resolver: ApiKeyResolver | null): void {
  apiKeyResolver = resolver;
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // SEC-23: Completely disallow query parameter tokens on all endpoints to prevent proxy log leakage
  if (req.query?.token || req.query?.ticket) {
    next(
      new AppError(
        "Không được phép truyền token xác thực qua query string",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      ),
    );
    return;
  }

  // SEC-25: Authenticate via API Key when x-api-key header is present
  const apiKeyHeader = (req.headers["x-api-key"] ||
    req.headers["x-api-key".toLowerCase()]) as string | undefined;

  if (apiKeyHeader && typeof apiKeyHeader === "string") {
    const trimmedKey = apiKeyHeader.trim();
    if (!trimmedKey) {
      next(new AppError("API Key không hợp lệ", 401, ERROR_CODE.UNAUTHORIZED));
      return;
    }

    // 1. Check if a custom / mock resolver is registered (for testing or extensions)
    if (apiKeyResolver) {
      try {
        const resolved = await apiKeyResolver(trimmedKey);
        if (resolved) {
          req.user = resolved.user;
          req.apiKey = resolved.apiKey;
          return next();
        }
      } catch (err: any) {
        return next(err);
      }
    }

    // 2. Try verifying as an RS256 JWT M2M API token
    if (trimmedKey.split(".").length === 3 && jwtConfig.publicKey) {
      try {
        const payload: any = jwt.verify(trimmedKey, jwtConfig.publicKey, {
          algorithms: [JWT_ALGORITHM.RS256],
        });
        if (payload && typeof payload === "object") {
          req.user = {
            id: payload.id || payload.sub,
            email: payload.email || "",
            role: payload.role || "API_CLIENT",
            roleId: payload.roleId,
            siteId: payload.siteId || null,
            siteIds: Array.isArray(payload.siteIds)
              ? payload.siteIds
              : payload.siteId
                ? [payload.siteId]
                : [],
            permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
          };
          req.apiKey = {
            id: payload.apiKeyId || payload.keyId || payload.sub || "api-key-jwt",
            name: payload.apiKeyName || payload.name || "API Key",
            prefix: payload.apiKeyPrefix || payload.prefix || "ak_",
            permissions: Array.isArray(payload.apiKeyPermissions)
              ? payload.apiKeyPermissions
              : Array.isArray(payload.permissions)
                ? payload.permissions
                : [],
          };
          return next();
        }
      } catch {
        // Fall through to Redis lookup
      }
    }

    // 3. Try looking up in Redis cache (keyed by sha256 hash of API key)
    const redis = getSharedRateLimitRedisClient();
    if (redis) {
      try {
        const keyHash = hashApiKey(trimmedKey);
        const cachedRaw = await redis.get(`apikey:${keyHash}`);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (cached && cached.isActive !== false) {
            req.user = {
              id: cached.user?.id || cached.userId,
              email: cached.user?.email || "",
              role: cached.user?.role?.name || cached.user?.role || "API_CLIENT",
              roleId: cached.user?.roleId,
              siteId: cached.user?.siteId || null,
              siteIds: Array.isArray(cached.user?.siteIds)
                ? cached.user.siteIds
                : cached.user?.siteId
                  ? [cached.user.siteId]
                  : [],
              permissions: Array.isArray(cached.user?.permissions)
                ? cached.user.permissions
                : [],
            };
            req.apiKey = {
              id: cached.id,
              name: cached.name || "API Key",
              prefix: cached.prefix || trimmedKey.slice(0, 8),
              permissions: Array.isArray(cached.permissions) ? cached.permissions : [],
            };
            return next();
          }
        }
      } catch {
        // Redis lookup failure
      }
    }

    next(new AppError("API Key không hợp lệ hoặc đã hết hạn", 401, ERROR_CODE.UNAUTHORIZED));
    return;
  }

  const token = extractTokenFromRequest(req);

  if (!token) {
    next(new AppError("Unauthorized", 401, ERROR_CODE.UNAUTHORIZED));
    return;
  }

  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded !== "object" || !decoded.header) {
      next(new AppError("Token không hợp lệ", 401, ERROR_CODE.UNAUTHORIZED));
      return;
    }

    const { alg } = decoded.header;
    let payload: any;

    if (alg !== JWT_ALGORITHM.RS256) {
      next(
        new AppError(
          `Thuật toán '${alg}' không được chấp nhận. Hệ thống chỉ hỗ trợ RS256.`,
          401,
          ERROR_CODE.UNAUTHORIZED,
        ),
      );
      return;
    }

    if (!jwtConfig.publicKey) {
      next(
        new AppError(
          "Cấu hình khóa công khai RS256 chưa sẵn sàng",
          500,
          ERROR_CODE.INTERNAL_SERVER_ERROR,
        ),
      );
      return;
    }

    payload = jwt.verify(token, jwtConfig.publicKey, {
      algorithms: [JWT_ALGORITHM.RS256],
    });

    if (!payload || typeof payload !== "object") {
      next(new AppError("Token không hợp lệ", 401, ERROR_CODE.UNAUTHORIZED));
      return;
    }

    // SEC-02: Isolate purpose claims - reject 2FA temp tokens on business endpoints
    if (payload.purpose && payload.purpose !== JWT_PURPOSE.ACCESS) {
      next(
        new AppError(
          "Token không có quyền truy cập API nghiệp vụ",
          401,
          ERROR_CODE.UNAUTHORIZED,
        ),
      );
      return;
    }

    // SEC-11: Enforce mustChangePassword flag - reject temporary credentials on business endpoints
    if (payload.mustChangePassword === true) {
      next(
        new AppError(
          "Yêu cầu đổi mật khẩu trước khi tiếp tục",
          403,
          ERROR_CODE.FORBIDDEN,
        ),
      );
      return;
    }

    // SEC-03: Extract tenancy scoping claims (siteId, siteIds) for BOLA protection
    req.user = {
      id: payload.id || payload.sub,
      email: payload.email,
      role: payload.role,
      roleId: payload.roleId,
      siteId: payload.siteId || null,
      siteIds: Array.isArray(payload.siteIds)
        ? payload.siteIds
        : payload.siteId
          ? [payload.siteId]
          : [],
      permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
    };

    next();
  } catch (error) {
    next(new AppError("Token xác thực không hợp lệ hoặc đã hết hạn", 401, ERROR_CODE.UNAUTHORIZED));
  }
}

/**
 * JWT & Asymmetric Cryptography Constants
 *
 * Quản lý tập trung các thuật toán ký, mục đích sử dụng (purpose),
 * và các thông số chuẩn RFC 7517 (JWKS) phục vụ Microservices Architecture.
 */

export const JWT_ALGORITHM = {
  RS256: "RS256",
  HS256: "HS256",
} as const;

export type JwtAlgorithm = (typeof JWT_ALGORITHM)[keyof typeof JWT_ALGORITHM];

export const JWT_PURPOSE = {
  ACCESS: "ACCESS",
  REFRESH: "REFRESH",
  TWO_FACTOR: "2FA_VERIFICATION",
  SSE_STREAM_TICKET: "SSE_STREAM_TICKET",
} as const;

export type JwtPurpose = (typeof JWT_PURPOSE)[keyof typeof JWT_PURPOSE];

export const JWKS_CONSTANTS = {
  DEFAULT_KEY_ID: "template-be-auth-key-1",
  KEY_USE: "sig",
  KEY_TYPE: "RSA",
  DEFAULT_CACHE_TTL_MS: 24 * 60 * 60 * 1000, // 24 giờ cache trong RAM
  WELL_KNOWN_JWKS_PATH: "/.well-known/jwks.json",
  HTTP_CACHE_CONTROL: "public, max-age=86400, stale-while-revalidate=3600",
  CONTENT_TYPE: "application/json; charset=utf-8",
} as const;

export type JwksConstants = typeof JWKS_CONSTANTS;

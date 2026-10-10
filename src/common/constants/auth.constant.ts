export const AUTH_PROVIDER = {
  LOCAL: "LOCAL",
  GOOGLE: "GOOGLE",
  ZALO: "ZALO",
} as const;

export type AuthProvider = keyof typeof AUTH_PROVIDER;

/**
 * Redirect URI mặc định cho Google OAuth2 trong môi trường development.
 * Chỉ được dùng khi GOOGLE_OAUTH_ALLOWED_REDIRECT_URIS chưa được cấu hình.
 * KHÔNG sử dụng trong production (fail-fast env validation sẽ chặn trước).
 */
export const GOOGLE_OAUTH_DEFAULT_DEV_REDIRECT_URI = "http://localhost:5173/auth/callback" as const;

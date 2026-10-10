import "dotenv/config";
import { z } from "zod";

const envSchema = z
  .object({
    // ── Core ─────────────────────────────────────────────────────────────────
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z.coerce.number().int().positive().default(9999),

    // ── Database (Database-per-Service Architecture) ─────────────────────────
    IDENTITY_DATABASE_URL: z
      .string()
      .min(1, "IDENTITY_DATABASE_URL is required"),
    // Các service DB URLs — optional vì không phải service nào cũng active đồng thời
    SITE_DATABASE_URL: z.string().optional(),
    CAMERA_DATABASE_URL: z.string().optional(),
    INCIDENT_DATABASE_URL: z.string().optional(),
    NOTIFICATION_DATABASE_URL: z.string().optional(),
    REPORTING_DATABASE_URL: z.string().optional(),

    // ── JWT ──────────────────────────────────────────────────────────────────
    JWT_ALGORITHM: z.enum(["RS256", "HS256"]).default("RS256"),
    JWT_KEY_ID: z.string().default("template-be-auth-key-1"),
    JWT_PRIVATE_KEY: z.string().default(""),
    JWT_PUBLIC_KEY: z.string().default(""),
    JWT_JWKS_CACHE_TTL_MS: z.coerce.number().int().positive().default(86400000),
    AUTH_JWKS_URL: z.string().default(""),
    JWT_ACCESS_SECRET: z.string().default("default_access_secret"),
    JWT_REFRESH_SECRET: z.string().default("default_refresh_secret"),
    /**
     * Secret riêng biệt dùng để ký 2FA temp token (purpose: "2FA_VERIFICATION").
     * Tách biệt khỏi JWT_ACCESS_SECRET để tránh token confusion attack.
     * Nếu không cấu hình, tự động fallback về JWT_ACCESS_SECRET + suffix "_2FA_TEMP".
     */
    JWT_TEMP_SECRET: z.string().default(""),
    JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
    JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

    // ── Trust Proxy ───────────────────────────────────────────────────────────
    TRUST_PROXY: z.string().default("false"),

    // ── API Gateway (Phase 4) ─────────────────────────────────────────────────
    /**
     * Secret nội bộ dùng để xác thực rằng request thực sự đến từ API Gateway (Traefik).
     * Gateway phải inject header `x-gateway-secret` với giá trị này.
     * Để trống trong dev/monolith mode → tắt kiểm tra (backward-compatible).
     * Bắt buộc cấu hình trong production khi deploy đằng sau Traefik.
     */
    GATEWAY_INTERNAL_SECRET: z.string().default(""),

    // ── CORS ─────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: z.string().default("*"),

    // ── Encryption ───────────────────────────────────────────────────────────
    ENCRYPTION_KEY: z.string().default(""),
    APP_SECRET: z.string().default(""),

    // ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_URL: z.string().default(""),
    REDIS_HOST: z.string().default("localhost"),
    REDIS_PORT: z.coerce.number().int().positive().default(6381),
    REDIS_PASSWORD: z.string().default(""),
    REDIS_ENABLED: z.string().default("true"),

    // ── Rate Limit ────────────────────────────────────────────────────────────
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(1000),
    AUTH_RATE_LIMIT_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(900000),
    AUTH_RATE_LIMIT_MAX_REQUESTS: z.coerce
      .number()
      .int()
      .positive()
      .default(30),

    // ── Cloudflare R2 ────────────────────────────────────────────────────────
    R2_ACCOUNT_ID: z.string().default(""),
    R2_BUCKET_NAME: z.string().default(""),
    R2_ACCESS_KEY_ID: z.string().default(""),
    R2_SECRET_ACCESS_KEY: z.string().default(""),
    R2_PUBLIC_BASE_URL: z.string().default(""),
    R2_PRESIGNED_URL_EXPIRES_IN_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(300),
    R2_AVATAR_MAX_FILE_SIZE_MB: z.coerce.number().positive().default(5),

    // ── MinIO / PPE Evidence Object Storage (BE-07) ──────────────────────────
    PPE_MINIO_ENDPOINT: z.string().default("http://localhost:9000"),
    PPE_MINIO_ROOT_USER: z.string().default("minio_admin"),
    PPE_MINIO_ROOT_PASSWORD: z.string().default("minio_admin_secret"),
    PPE_MINIO_BUCKET_EVIDENCES: z.string().default("ppe-evidences"),
    PPE_MINIO_FORCE_PATH_STYLE: z.string().default("true"),

    // ── Notification Service & Worker (Phase 5: Satellite Microservice) ──────
    NOTIFICATION_WORKER_ENABLED: z.string().default("true"),
    NOTIFICATION_WORKER_INTERVAL_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(60000),
    NOTIFICATION_PORT: z.coerce.number().int().positive().default(8889),
    NOTIFICATION_SERVICE_STANDALONE: z.string().default("false"),
    NOTIFICATION_SERVICE_URL: z.string().default("http://localhost:8889"),

    // ── Media & File Storage Service (Phase 6: Satellite Microservice) ────────
    MEDIA_PORT: z.coerce.number().int().positive().default(8890),
    MEDIA_SERVICE_STANDALONE: z.string().default("false"),
    MEDIA_SERVICE_URL: z.string().default("http://localhost:8890"),

    // ── Site Management Service (Database-per-Service Architecture :8891) ─────
    SITE_PORT: z.coerce.number().int().positive().default(8891),
    SITE_SERVICE_STANDALONE: z.string().default("false"),
    SITE_SERVICE_URL: z.string().default("http://localhost:8891"),

    // ── Camera Management Service (Database-per-Service Architecture :8892) ───
    CAMERA_PORT: z.coerce.number().int().positive().default(8892),
    CAMERA_SERVICE_STANDALONE: z.string().default("false"),
    CAMERA_SERVICE_URL: z.string().default("http://localhost:8892"),

    // ── Incident Management Service (Database-per-Service Architecture :8893) ─
    INCIDENT_PORT: z.coerce.number().int().positive().default(8893),
    INCIDENT_SERVICE_STANDALONE: z.string().default("false"),
    INCIDENT_SERVICE_URL: z.string().default("http://localhost:8893"),



    // ── Webhook ───────────────────────────────────────────────────────────────
    WEBHOOK_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),

    // ── Google OAuth2 ─────────────────────────────────────────────────────────
    GOOGLE_CLIENT_ID: z.string().default(""),
    GOOGLE_CLIENT_SECRET: z.string().default(""),
    /**
     * Danh sách Redirect URI được phép dùng trong Google OAuth2 flow.
     * Phân cách bằng dấu phẩy. Ví dụ:
     *   http://localhost:3000/auth/callback,https://myapp.com/auth/callback
     * Bắt buộc khai báo trong môi trường production.
     */
    GOOGLE_OAUTH_ALLOWED_REDIRECT_URIS: z.string().default(""),

    // ── Application Base URL & Cloud Deployment ───────────────────────────────
    APP_URL: z.string().default("http://localhost:7777"),
    /** Domain công khai tự động gán bởi Render (vd: https://my-app.onrender.com) */
    RENDER_EXTERNAL_URL: z.string().default(""),

    // ── Mail Multi-Tier Dispatch Pipeline (Resend / Webhook / SMTP) ───────────
    /** Khóa API Resend HTTPS REST (ưu tiên Tầng 1 - Port 443 không bao giờ bị chặn) */
    RESEND_API_KEY: z.string().default(""),
    /** URL HTTP Webhook relay email (Tầng 2 - Port 443 e.g. Google Apps Script) */
    MAIL_WEBHOOK_URL: z.string().default(""),
    MAIL_HOST: z.string().default("smtp.gmail.com"),
    MAIL_PORT: z.coerce.number().int().positive().default(587),
    MAIL_SECURE: z.string().default("false"),
    MAIL_USER: z.string().default(""),
    MAIL_PASS: z.string().default(""),
    MAIL_FROM: z.string().default("App Template <noreply@gmail.com>"),

    // ── Cloudflare Turnstile Captcha ──────────────────────────────────────────
    TURNSTILE_ENABLED: z.string().default("false"),
    TURNSTILE_SECRET_KEY: z.string().default(""),

    // ── RFC 9116 Security.txt ─────────────────────────────────────────────────
    SECURITY_CONTACT_EMAIL: z.string().default("security@example.com"),
    SECURITY_POLICY_URL: z.string().default(""),
    SECURITY_ACKNOWLEDGMENTS_URL: z.string().default(""),
  })
  // ── Production-only Constraints ───────────────────────────────────────────
  .refine(
    (env) => {
      if (env.NODE_ENV !== "production") return true;
      return (
        env.JWT_ACCESS_SECRET !== "default_access_secret" &&
        env.JWT_ACCESS_SECRET.length >= 32
      );
    },
    {
      message:
        "JWT_ACCESS_SECRET must be securely set in production and at least 32 characters long (không được để mặc định hoặc ngắn hơn 32 ký tự)",
      path: ["JWT_ACCESS_SECRET"],
    },
  )
  .refine(
    (env) => {
      if (env.NODE_ENV !== "production") return true;
      return (
        env.JWT_REFRESH_SECRET !== "default_refresh_secret" &&
        env.JWT_REFRESH_SECRET.length >= 32
      );
    },
    {
      message:
        "JWT_REFRESH_SECRET must be securely set in production and at least 32 characters long (không được để mặc định hoặc ngắn hơn 32 ký tự)",
      path: ["JWT_REFRESH_SECRET"],
    },
  )
  .refine(
    (env) => {
      if (env.NODE_ENV !== "production") return true;
      const origins = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
      return !origins.includes("*");
    },
    {
      message:
        "ALLOWED_ORIGINS must be explicitly set with trusted domains in production (wildcard * is not allowed)",
      path: ["ALLOWED_ORIGINS"],
    },
  )
  .refine(
    (env) => {
      if (env.NODE_ENV !== "production") return true;
      const key = env.ENCRYPTION_KEY || env.APP_SECRET;
      return typeof key === "string" && key.length >= 32;
    },
    {
      message:
        "ENCRYPTION_KEY (or APP_SECRET) must be explicitly configured with at least 32 characters in production",
      path: ["ENCRYPTION_KEY"],
    },
  )
  .refine(
    (env) => {
      if (env.NODE_ENV !== "production") return true;
      // Bắt buộc khai báo allowlist redirect URI cho Google OAuth trong production
      const uris = env.GOOGLE_OAUTH_ALLOWED_REDIRECT_URIS.trim();
      return uris.length > 0;
    },
    {
      message:
        "GOOGLE_OAUTH_ALLOWED_REDIRECT_URIS phải được khai báo tường minh trong production (danh sách URI cụ thể phân cách bởi dấu phẩy, ví dụ: https://myapp.com/auth/callback)",
      path: ["GOOGLE_OAUTH_ALLOWED_REDIRECT_URIS"],
    },
  )
  .refine(
    (env) => {
      if (env.NODE_ENV !== "production") return true;
      if (env.TURNSTILE_ENABLED === "true") {
        return (
          typeof env.TURNSTILE_SECRET_KEY === "string" &&
          env.TURNSTILE_SECRET_KEY.trim().length > 0 &&
          !env.TURNSTILE_SECRET_KEY.startsWith("1x00000000")
        );
      }
      return true;
    },
    {
      message:
        "TURNSTILE_SECRET_KEY must be securely configured with a real Cloudflare secret key when TURNSTILE_ENABLED=true in production (dummy test keys are not allowed)",
      path: ["TURNSTILE_SECRET_KEY"],
    },
  )
  .refine(
    (env) => {
      if (env.NODE_ENV !== "production") return true;
      if (env.JWT_ALGORITHM === "RS256") {
        return (
          typeof env.JWT_PRIVATE_KEY === "string" &&
          env.JWT_PRIVATE_KEY.trim().length > 0
        );
      }
      return true;
    },
    {
      message:
        "JWT_PRIVATE_KEY bắt buộc phải được cấu hình khi JWT_ALGORITHM=RS256 trong môi trường production (định dạng PEM, base64 hoặc đường dẫn file)",
      path: ["JWT_PRIVATE_KEY"],
    },
  )
  .refine(
    (env) => {
      if (env.NODE_ENV !== "production") return true;
      if (
        typeof env.GATEWAY_INTERNAL_SECRET === "string" &&
        env.GATEWAY_INTERNAL_SECRET.trim().length > 0
      ) {
        return env.GATEWAY_INTERNAL_SECRET.length >= 32;
      }
      return true;
    },
    {
      message:
        "GATEWAY_INTERNAL_SECRET phải có độ dài tối thiểu 32 ký tự khi được cấu hình trong môi trường production",
      path: ["GATEWAY_INTERNAL_SECRET"],
    },
  );

const _parsed = envSchema.safeParse(process.env);

if (!_parsed.success) {
  const issues = _parsed.error.issues
    .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  const errorMsg = `\n[ENV] ❌ Lỗi cấu hình biến môi trường — server không thể khởi động:\n${issues}\n\n`;
  process.stderr.write(errorMsg);
  throw new Error(errorMsg);
}

const _env = _parsed.data;

/** Phân giải giá trị TRUST_PROXY sang kiểu mà Express chấp nhận */
function parseTrustProxy(val: string): boolean | number | string | string[] {
  if (val === "true") return true;
  if (val === "false") return false;
  if (/^\d+$/.test(val)) return parseInt(val, 10);
  if (val.includes(",")) return val.split(",").map((s) => s.trim());
  return val;
}

/** Giải quyết encryption key theo thứ tự ưu tiên: ENCRYPTION_KEY > APP_SECRET. Tuyệt đối không fallback sang JWT_ACCESS_SECRET trong production */
function resolveEncryptionKey(): string {
  const key = _env.ENCRYPTION_KEY || _env.APP_SECRET;
  if (key && key.length >= 32) {
    return key;
  }
  if (_env.NODE_ENV === "production") {
    throw new Error(
      "ENCRYPTION_KEY or APP_SECRET must be explicitly configured with at least 32 characters in production",
    );
  }
  return (
    key || _env.JWT_ACCESS_SECRET || "default_32_bytes_secret_key_aes256_gcm!!"
  );
}

/** Phân giải cấu hình Redis: ưu tiên REDIS_URL (DSN) nếu có, fallback sang biến đơn */
function resolveRedisConfig() {
  let host = _env.REDIS_HOST;
  let port = _env.REDIS_PORT;
  let password: string | undefined = _env.REDIS_PASSWORD || undefined;

  if (_env.REDIS_URL) {
    try {
      const parsed = new URL(_env.REDIS_URL);
      host = parsed.hostname || host;
      port = parsed.port
        ? parseInt(parsed.port, 10)
        : parsed.protocol === "rediss:"
          ? 6380
          : 6379;
      if (parsed.password) {
        password = decodeURIComponent(parsed.password);
      }
    } catch {
      // URL không hợp lệ - fallback về biến đơn đã được parse ở trên
    }
  }

  return {
    host,
    port,
    password,
    enabled: _env.REDIS_ENABLED !== "false",
  };
}

export const envConfig = {
  nodeEnv: _env.NODE_ENV,
  port: _env.PORT,
  database: {
    url: _env.IDENTITY_DATABASE_URL,
    siteUrl: _env.SITE_DATABASE_URL,
    cameraUrl: _env.CAMERA_DATABASE_URL,
    incidentUrl: _env.INCIDENT_DATABASE_URL,
    notificationUrl: _env.NOTIFICATION_DATABASE_URL,
    reportingUrl: _env.REPORTING_DATABASE_URL,
  },
  jwt: {
    algorithm: _env.JWT_ALGORITHM,
    keyId: _env.JWT_KEY_ID,
    privateKey: _env.JWT_PRIVATE_KEY,
    publicKey: _env.JWT_PUBLIC_KEY,
    jwksCacheTtlMs: _env.JWT_JWKS_CACHE_TTL_MS,
    authJwksUrl: _env.AUTH_JWKS_URL,
    accessSecret: _env.JWT_ACCESS_SECRET,
    refreshSecret: _env.JWT_REFRESH_SECRET,
    /**
     * Secret dành riêng cho 2FA temp token. Fallback an toàn về accessSecret + "_2FA_TEMP"
     * nếu JWT_TEMP_SECRET chưa được khai báo tường minh.
     */
    tempSecret:
      _env.JWT_TEMP_SECRET && _env.JWT_TEMP_SECRET.length > 0
        ? _env.JWT_TEMP_SECRET
        : _env.JWT_ACCESS_SECRET + "_2FA_TEMP",
    accessExpiresIn: _env.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: _env.JWT_REFRESH_EXPIRES_IN,
  },
  trustProxy: parseTrustProxy(_env.TRUST_PROXY),
  gateway: {
    /**
     * Secret nội bộ để xác thực request từ API Gateway (Traefik).
     * Empty string → kiểm tra bị tắt (monolith / dev mode).
     */
    internalSecret: _env.GATEWAY_INTERNAL_SECRET || "",
  },
  cors: {
    allowedOrigins: _env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()),
  },
  r2: {
    accountId: _env.R2_ACCOUNT_ID,
    bucketName: _env.R2_BUCKET_NAME,
    accessKeyId: _env.R2_ACCESS_KEY_ID,
    secretAccessKey: _env.R2_SECRET_ACCESS_KEY,
    publicBaseUrl: _env.R2_PUBLIC_BASE_URL,
    presignedUrlExpiresIn: _env.R2_PRESIGNED_URL_EXPIRES_IN_SECONDS,
    avatarMaxFileSizeMb: _env.R2_AVATAR_MAX_FILE_SIZE_MB,
  },
  notification: {
    workerEnabled: _env.NOTIFICATION_WORKER_ENABLED !== "false",
    workerIntervalMs: _env.NOTIFICATION_WORKER_INTERVAL_MS,
    port: _env.NOTIFICATION_PORT,
    standalone: _env.NOTIFICATION_SERVICE_STANDALONE === "true",
    serviceUrl: _env.NOTIFICATION_SERVICE_URL,
  },
  media: {
    port: _env.MEDIA_PORT,
    standalone: _env.MEDIA_SERVICE_STANDALONE === "true",
    serviceUrl: _env.MEDIA_SERVICE_URL,
  },
  site: {
    port: _env.SITE_PORT,
    standalone: _env.SITE_SERVICE_STANDALONE === "true",
    serviceUrl: _env.SITE_SERVICE_URL,
  },
  camera: {
    port: _env.CAMERA_PORT,
    standalone: _env.CAMERA_SERVICE_STANDALONE === "true",
    serviceUrl: _env.CAMERA_SERVICE_URL,
  },
  incident: {
    port: _env.INCIDENT_PORT,
    standalone: _env.INCIDENT_SERVICE_STANDALONE === "true",
    serviceUrl: _env.INCIDENT_SERVICE_URL,
  },
  minio: {
    endpoint: _env.PPE_MINIO_ENDPOINT,
    accessKeyId: _env.PPE_MINIO_ROOT_USER,
    secretAccessKey: _env.PPE_MINIO_ROOT_PASSWORD,
    bucketEvidences: _env.PPE_MINIO_BUCKET_EVIDENCES,
    forcePathStyle: _env.PPE_MINIO_FORCE_PATH_STYLE !== "false",
  },


  rateLimit: {
    windowMs: _env.RATE_LIMIT_WINDOW_MS,
    maxRequests: _env.RATE_LIMIT_MAX_REQUESTS,
    authWindowMs: _env.AUTH_RATE_LIMIT_WINDOW_MS,
    authMaxRequests: _env.AUTH_RATE_LIMIT_MAX_REQUESTS,
  },
  encryption: {
    key: resolveEncryptionKey(),
  },
  redis: resolveRedisConfig(),
  webhook: {
    maxAttempts: _env.WEBHOOK_MAX_ATTEMPTS,
    timeoutMs: _env.WEBHOOK_TIMEOUT_MS,
  },
  google: {
    clientId: _env.GOOGLE_CLIENT_ID,
    clientSecret: _env.GOOGLE_CLIENT_SECRET,
    /**
     * Danh sách Redirect URI được phép dùng trong OAuth flow (exact match).
     * Trống trong development → fallback về localhost an toàn.
     * Production → fail-fast nếu chưa khai báo.
     */
    allowedRedirectUris: _env.GOOGLE_OAUTH_ALLOWED_REDIRECT_URIS
      ? _env.GOOGLE_OAUTH_ALLOWED_REDIRECT_URIS.split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
  },
  appUrl: _env.APP_URL,
  renderExternalUrl: _env.RENDER_EXTERNAL_URL,
  mail: {
    host: _env.MAIL_HOST,
    port: _env.MAIL_PORT,
    secure: _env.MAIL_SECURE === "true",
    user: _env.MAIL_USER,
    pass: _env.MAIL_PASS,
    from: _env.MAIL_FROM,
    resendApiKey: _env.RESEND_API_KEY,
    webhookUrl: _env.MAIL_WEBHOOK_URL,
  },
  turnstile: {
    enabled: _env.TURNSTILE_ENABLED === "true",
    secretKey: _env.TURNSTILE_SECRET_KEY,
  },
  securityTxt: {
    contactEmail: _env.SECURITY_CONTACT_EMAIL,
    policyUrl: _env.SECURITY_POLICY_URL,
    acknowledgmentsUrl: _env.SECURITY_ACKNOWLEDGMENTS_URL,
  },
} as const;

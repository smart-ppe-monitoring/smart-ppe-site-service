/**
 * API Gateway & Reverse Proxy Constants (Phase 4)
 *
 * Tập trung toàn bộ tên header và hằng số liên quan đến API Gateway (Traefik).
 * Không hard-code tên header ở bất kỳ nơi nào khác trong codebase.
 */

/**
 * Headers chuẩn được inject bởi API Gateway (Traefik).
 * Các giá trị này phải khớp chính xác với cấu hình Traefik middleware.
 */
export const GATEWAY_HEADERS = {
  /**
   * Correlation ID để truy vết phân tán (Distributed Tracing).
   * Traefik tự động inject hoặc forward header này vào mọi request.
   * Format: UUIDv7 (time-ordered, chuẩn RFC 9562).
   */
  REQUEST_ID: "x-request-id",

  /**
   * Địa chỉ IP thực của client sau khi đi qua Traefik / Cloudflare.
   * Traefik inject header này thay thế cho x-forwarded-for (chống spoofing).
   */
  REAL_IP: "x-real-ip",

  /**
   * Secret nội bộ để xác thực request thực sự đến từ API Gateway,
   * không phải request trực tiếp bypass gateway. Phải khớp với
   * GATEWAY_INTERNAL_SECRET trong .env.
   */
  INTERNAL_SECRET: "x-gateway-secret",

  /**
   * Tên upstream service được gateway định tuyến đến.
   * Traefik inject header này cho phép service biết mình được gọi từ đâu.
   */
  FORWARDED_SERVICE: "x-forwarded-service",

  /**
   * Proto ban đầu (http/https) trước khi SSL termination tại gateway.
   */
  FORWARDED_PROTO: "x-forwarded-proto",

  /**
   * Host ban đầu (domain) của request trước khi đi qua gateway.
   */
  FORWARDED_HOST: "x-forwarded-host",
} as const;

export type GatewayHeader =
  (typeof GATEWAY_HEADERS)[keyof typeof GATEWAY_HEADERS];

/**
 * Cấu hình Traefik labels cho Docker Compose.
 * Chỉ dùng làm tài liệu tham chiếu - giá trị thực nằm trong docker-compose.yml.
 */
export const TRAEFIK_LABELS = {
  /** Enable Traefik cho container này */
  ENABLE: "traefik.enable",
  /** Router rule (host/path matching) */
  ROUTER_RULE: "traefik.http.routers.{name}.rule",
  /** Service port (internal container port) */
  SERVICE_PORT: "traefik.http.services.{name}.loadbalancer.server.port",
  /** Middleware chain */
  ROUTER_MIDDLEWARES: "traefik.http.routers.{name}.middlewares",
} as const;

/**
 * Các route prefix được API Gateway định tuyến.
 * Phải đồng bộ với Traefik routing rules trong docker-compose.yml.
 */
export const GATEWAY_ROUTES = {
  AUTH: "/api/v1/auth",
  USERS: "/api/v1/users",
  RBAC: "/api/v1/rbac",
  FILES: "/api/v1/files",
  NOTIFICATIONS: "/api/v1/notifications",
  SYSTEM: "/api/v1/system",
  HEALTH: "/api/v1/health",
  MAINTENANCE: "/api/v1/maintenance",
  CRON: "/api/v1/cron",
  INTEGRATIONS: "/api/v1/integrations",
} as const;

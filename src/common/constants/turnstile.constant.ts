/**
 * Cloudflare Turnstile Constants
 *
 * Quản lý tập trung các URL, headers, dummy secret keys và action names
 * dùng cho xác thực CAPTCHA chống spam / bot.
 */

export const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify" as const;

/**
 * Cloudflare Dummy Secret Keys phục vụ kiểm thử và môi trường phát triển (Testing & Dev)
 * Theo tài liệu chính thức của Cloudflare:
 * - 1x0000000000000000000000000000000AA: Luôn luôn Pass
 * - 2x0000000000000000000000000000000AA: Luôn luôn Fail
 * - 3x0000000000000000000000000000000AA: Báo lỗi Token đã sử dụng (token already spent)
 */
export const TURNSTILE_DUMMY_SECRET_PASS =
  "1x0000000000000000000000000000000AA" as const;
export const TURNSTILE_DUMMY_SECRET_FAIL =
  "2x0000000000000000000000000000000AA" as const;
export const TURNSTILE_DUMMY_SECRET_SPENT =
  "3x0000000000000000000000000000000AA" as const;

/**
 * HTTP Headers dùng để truyền Turnstile Response Token từ client
 */
export const TURNSTILE_HEADERS = {
  RESPONSE: "cf-turnstile-response",
  TOKEN: "x-turnstile-token",
} as const;

/**
 * Request body key quy ước cho Turnstile Token
 */
export const TURNSTILE_BODY_KEY = "turnstileToken" as const;

/**
 * Danh sách hành động (Action) bảo vệ bởi Turnstile
 */
export const TURNSTILE_ACTION = {
  REGISTER: "register",
  LOGIN: "login",
  FORGOT_PASSWORD: "forgot_password",
  RESEND_VERIFICATION: "resend_verification",
} as const;

export type TurnstileAction =
  (typeof TURNSTILE_ACTION)[keyof typeof TURNSTILE_ACTION];

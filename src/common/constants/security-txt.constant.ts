/**
 * RFC 9116 Security.txt Constants
 *
 * Định nghĩa các hằng số, đường dẫn và giá trị mặc định cho chính sách
 * báo cáo lỗ hổng bảo mật theo tiêu chuẩn IETF RFC 9116.
 */

export const SECURITY_TXT_PATHS = {
  WELL_KNOWN: "/.well-known/security.txt",
  LEGACY: "/security.txt",
} as const;

export const SECURITY_TXT_DEFAULTS = {
  CONTACT_EMAIL: "security@example.com",
  PREFERRED_LANGUAGES: "en, vi",
  EXPIRY_DAYS: 365,
} as const;

export type SecurityTxtPath =
  (typeof SECURITY_TXT_PATHS)[keyof typeof SECURITY_TXT_PATHS];

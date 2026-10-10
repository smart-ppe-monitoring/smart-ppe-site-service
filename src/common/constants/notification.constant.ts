export const NOTIFICATION_TYPE = {
  SYSTEM: "SYSTEM",
  ALERT: "ALERT",
  INFO: "INFO",
  SUCCESS: "SUCCESS",
  WARNING: "WARNING",
  PPE_VIOLATION: "PPE_VIOLATION",
} as const;

export type NotificationType = keyof typeof NOTIFICATION_TYPE;

export const NOTIFICATION_PRIORITY = {
  LOW: "LOW",
  NORMAL: "NORMAL",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;

export type NotificationPriority = keyof typeof NOTIFICATION_PRIORITY;

export const NOTIFICATION_SEVERITY = {
  LOW: "LOW",
  NORMAL: "NORMAL",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;

export type NotificationSeverity = keyof typeof NOTIFICATION_SEVERITY;

export const SEVERITY_WEIGHT: Record<string, number> = {
  LOW: 1,
  NORMAL: 2,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export const NOTIFICATION_CHANNEL = {
  IN_APP: "IN_APP",
  WEB: "WEB",
  EMAIL: "EMAIL",
  ZALO_ZNS: "ZALO_ZNS",
  WEBHOOK: "WEBHOOK",
} as const;

export type NotificationChannel = keyof typeof NOTIFICATION_CHANNEL;

export const NOTIFICATION_STATUS = {
  PENDING: "PENDING",
  SENT: "SENT",
  FAILED: "FAILED",
  READ: "READ",
} as const;

export type NotificationStatus = keyof typeof NOTIFICATION_STATUS;

export const NOTIFICATION_TEMPLATE_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;

export type NotificationTemplateStatus =
  keyof typeof NOTIFICATION_TEMPLATE_STATUS;

export const NOTIFICATION_TEMPLATE_CODE = {
  PPE_VIOLATION_ALERT: "PPE_VIOLATION_ALERT",
  INCIDENT_ASSIGNED: "INCIDENT_ASSIGNED",
  INCIDENT_RESOLVED: "INCIDENT_RESOLVED",
  VERIFY_EMAIL: "VERIFY_EMAIL",
  RESET_PASSWORD: "RESET_PASSWORD",
  NEW_DEVICE_ALERT: "NEW_DEVICE_ALERT",
  WELCOME: "WELCOME",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",
  ROLE_ASSIGNED: "ROLE_ASSIGNED",
  ACTIVITY_SUMMARY_DIGEST: "ACTIVITY_SUMMARY_DIGEST",
  CUSTOM: "CUSTOM",
} as const;

export type NotificationTemplateCode =
  keyof typeof NOTIFICATION_TEMPLATE_CODE;

export const EMAIL_TEMPLATE_KEY = {
  PPE_VIOLATION_ALERT: "PPE_VIOLATION_ALERT",
  INCIDENT_ASSIGNED: "INCIDENT_ASSIGNED",
  INCIDENT_RESOLVED: "INCIDENT_RESOLVED",
  VERIFY_EMAIL: "VERIFY_EMAIL",
  RESET_PASSWORD: "RESET_PASSWORD",
  NEW_DEVICE_ALERT: "NEW_DEVICE_ALERT",
  ACTIVITY_SUMMARY_DIGEST: "ACTIVITY_SUMMARY_DIGEST",
  CUSTOM: "CUSTOM",
} as const;

export type EmailTemplateKey = keyof typeof EMAIL_TEMPLATE_KEY;

export const EMAIL_STATUS = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  SENT: "SENT",
  FAILED: "FAILED",
} as const;

export type EmailStatus = keyof typeof EMAIL_STATUS;

export const EMAIL_MAX_ATTEMPTS = 3;

export const DEFAULT_EMAIL_SUBJECTS: Record<string, string> = {
  PPE_VIOLATION_ALERT: "🚨 CẢNH BÁO VI PHẠM TRANG BỊ BẢO HỘ PPE",
  INCIDENT_ASSIGNED: "📋 BẠN ĐƯỢC PHÂN CÔNG XỬ LÝ SỰ CỐ AN TOÀN",
  INCIDENT_RESOLVED: "✅ SỰ CỐ AN TOÀN LAO ĐỘNG ĐÃ ĐƯỢC GIẢI QUYẾT",
  VERIFY_EMAIL: "Xác thực tài khoản của bạn",
  RESET_PASSWORD: "Đặt lại mật khẩu",
  NEW_DEVICE_ALERT: "Phát hiện đăng nhập từ thiết bị mới",
  ACTIVITY_SUMMARY_DIGEST: "Báo cáo tổng kết hoạt động hệ thống",
  CUSTOM: "Thông báo từ hệ thống",
};

export const DEFAULT_PREFERENCES = [
  {
    channel: NOTIFICATION_CHANNEL.IN_APP,
    enabled: true,
    severityThreshold: NOTIFICATION_SEVERITY.LOW,
  },
  {
    channel: NOTIFICATION_CHANNEL.EMAIL,
    enabled: true,
    severityThreshold: NOTIFICATION_SEVERITY.HIGH,
  },
] as const;


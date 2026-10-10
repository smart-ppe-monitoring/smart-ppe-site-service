export const SYSTEM_CONFIG_CATEGORY = {
  GENERAL: "GENERAL",
  FEATURE_FLAG: "FEATURE_FLAG",
  INTEGRATION: "INTEGRATION",
  SECURITY: "SECURITY",
} as const;

export type SystemConfigCategory = keyof typeof SYSTEM_CONFIG_CATEGORY;

export const FEATURE_FLAGS = {
  REGISTRATION_ENABLED: "feature.registration.enabled",
  NOTIFICATIONS_ENABLED: "feature.notifications.enabled",
  WEBHOOKS_ENABLED: "feature.webhooks.enabled",
  AI_ENABLED: "feature.ai.enabled",
  SOCIAL_LOGIN_ENABLED: "feature.social_login.enabled",
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

export const DEFAULT_SYSTEM_CONFIGS = [
  {
    key: "app.name",
    value: "Backend Template Platform",
    description: "Tên ứng dụng hiển thị công khai",
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: true,
  },
  {
    key: "app.support_email",
    value: "support@example.com",
    description: "Email liên hệ hỗ trợ khách hàng",
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: true,
  },
  {
    key: "app.timezone",
    value: "Asia/Ho_Chi_Minh",
    description:
      "Múi giờ chuẩn mặc định của hệ thống (UTC+7 / Asia/Ho_Chi_Minh)",
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: true,
  },
  {
    key: "app.locale",
    value: "vi-VN",
    description: "Ngôn ngữ và định dạng vùng mặc định (Tiếng Việt)",
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: true,
  },

  {
    key: FEATURE_FLAGS.REGISTRATION_ENABLED,
    value: true,
    description: "Cho phép người dùng mới đăng ký tài khoản tự do",
    category: SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
    isPublic: true,
  },
  {
    key: FEATURE_FLAGS.NOTIFICATIONS_ENABLED,
    value: true,
    description: "Bật hệ thống gửi thông báo và email tự động",
    category: SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
    isPublic: false,
  },
  {
    key: FEATURE_FLAGS.WEBHOOKS_ENABLED,
    value: true,
    description: "Bật hạ tầng Webhook dispatching và retry worker",
    category: SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
    isPublic: false,
  },
  {
    key: FEATURE_FLAGS.AI_ENABLED,
    value: false,
    description: "Bật các tính năng và API hỗ trợ AI",
    category: SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
    isPublic: true,
  },
  {
    key: FEATURE_FLAGS.SOCIAL_LOGIN_ENABLED,
    value: true,
    description: "Bật tính năng đăng nhập mạng xã hội (Google, Zalo)",
    category: SYSTEM_CONFIG_CATEGORY.FEATURE_FLAG,
    isPublic: true,
  },

  // Storage & Media Management Configurations
  {
    key: "storage.max_file_size_mb",
    value: 100,
    description: "Dung lượng tệp tải lên tối đa cho phép (MB)",
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: true,
  },
  {
    key: "storage.allowed_mime_types",
    value: [
      "image/*",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "text/csv",
      "video/mp4",
      "audio/mpeg",
    ],
    description: "Danh sách MIME types hoặc mẫu wildcard cho phép tải lên",
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: true,
  },
  {
    key: "storage.upload_expires_seconds",
    value: 300,
    description:
      "Thời hạn hiệu lực của link tải lên Presigned Upload URL (giây)",
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: true,
  },
  {
    key: "storage.download_expires_seconds",
    value: 3600,
    description:
      "Thời hạn hiệu lực của link tải xuống Presigned Download URL (giây)",
    category: SYSTEM_CONFIG_CATEGORY.GENERAL,
    isPublic: true,
  },
] as const;

export const STORAGE_CONFIG_KEYS = {
  MAX_FILE_SIZE_MB: "storage.max_file_size_mb",
  ALLOWED_MIME_TYPES: "storage.allowed_mime_types",
  UPLOAD_EXPIRES_SECONDS: "storage.upload_expires_seconds",
  DOWNLOAD_EXPIRES_SECONDS: "storage.download_expires_seconds",
} as const;

export const DEFAULT_ALLOWED_MIME_TYPES = [
  "image/*",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "video/mp4",
  "audio/mpeg",
] as const;

export const SYSTEM_CONFIG_PUBSUB_CHANNEL = "system_config:events";

/**
 * Event-Driven Backbone Constants (Phase 3)
 *
 * Định nghĩa hợp đồng sự kiện (Event Contract Matrix),
 * trạng thái Outbox và cấu hình Dead-Letter Queue (DLQ).
 */

export const EVENT_NAMES = {
  AUTH_USER_REGISTERED: "auth.user_registered",
  AUTH_VERIFICATION_REQUESTED: "auth.verification_requested",
  AUTH_PASSWORD_RESET_REQUESTED: "auth.password_reset_requested",
  AUTH_NEW_DEVICE_DETECTED: "auth.new_device_detected",
  AUTH_DEACTIVATION_REQUESTED: "auth.deactivation_requested",
  USER_SOFT_DELETED: "user.soft_deleted",
  FILE_UPLOADED_UNCONFIRMED: "file.uploaded_unconfirmed",

  // PPE Domain Kafka & EventBus Events
  PPE_VIOLATION_DETECTED: "ppe.violation.detected",
  PPE_INCIDENT_CREATED: "ppe.incident.created",
  PPE_INCIDENT_ASSIGNED: "ppe.incident.assigned",
  PPE_INCIDENT_RESOLVED: "ppe.incident.resolved",
  PPE_CAMERA_STATUS_CHANGED: "ppe.camera.status_changed",
  PPE_SITE_ALERT_TRIGGERED: "ppe.site.alert_triggered",
} as const;

export type EventName = (typeof EVENT_NAMES)[keyof typeof EVENT_NAMES];

export const OUTBOX_STATUS = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  PUBLISHED: "PUBLISHED",
  FAILED: "FAILED",
} as const;

export type OutboxStatus = (typeof OUTBOX_STATUS)[keyof typeof OUTBOX_STATUS];

export const EVENT_BUS_CONSTANTS = {
  DEFAULT_QUEUE_NAME: "events-backbone-queue",
  NOTIFICATION_QUEUE_NAME: "events-notification-queue",
  DLQ_QUEUE_NAME: "events-dead-letter-queue",
  DEFAULT_MAX_ATTEMPTS: 5,
  DEFAULT_BACKOFF_DELAY_MS: 1000,
  IDEMPOTENCY_TTL_MS: 24 * 60 * 60 * 1000, // 24 giờ lưu trữ Event ID để chống trùng lặp
  OUTBOX_POLL_INTERVAL_MS: 5000,
  OUTBOX_BATCH_SIZE: 50,
} as const;

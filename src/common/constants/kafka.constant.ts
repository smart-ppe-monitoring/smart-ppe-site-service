/**
 * Apache Kafka Event Bus Constants for PPE Microservices
 *
 * Quản lý tập trung:
 * - Kafka Topics cho toàn bộ hệ sinh thái PPE
 * - Consumer Groups cho các microservices vệ tinh
 * - Các hằng số phân loại PPE (Violation Types, Severity, Classes)
 */

export const KAFKA_TOPICS = {
  // Topic cốt lõi: AI Camera Engine bắn sự kiện vi phạm PPE
  PPE_VIOLATION_DETECTED: "ppe.violation.detected",

  // Sự kiện xử lý và đóng sự cố vi phạm
  PPE_INCIDENT_RESOLVED: "ppe.incident.resolved",

  // Sự kiện thay đổi trạng thái camera (Online / Offline / Degraded)
  PPE_CAMERA_STATUS_CHANGED: "ppe.camera.status_changed",

  // Sự kiện cảnh báo vượt ngưỡng an toàn tại công trường
  PPE_SITE_ALERT_TRIGGERED: "ppe.site.alert_triggered",

  // Topic thông báo thời gian thực (Push / Email / Webhook)
  NOTIFICATION_DISPATCH: "notification.dispatch",

  // Dead Letter Queue cho các tin nhắn lỗi / poison pills
  PPE_DEAD_LETTER_QUEUE: "ppe.dead-letter-queue",
} as const;

export type KafkaTopic = (typeof KAFKA_TOPICS)[keyof typeof KAFKA_TOPICS];

export const PPE_VIOLATION_TYPES = {
  NO_HELMET: "NO_HELMET",
  NO_VEST: "NO_VEST",
  NO_BOOTS: "NO_BOOTS",
  NO_GLOVES: "NO_GLOVES",
  NO_GOGGLES: "NO_GOGGLES",
  NO_HARNESS: "NO_HARNESS",
  UNAUTHORIZED_ZONE: "UNAUTHORIZED_ZONE",
} as const;

export type PPEViolationType =
  (typeof PPE_VIOLATION_TYPES)[keyof typeof PPE_VIOLATION_TYPES];

export const PPE_SEVERITY = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;

export type PPESeverity = (typeof PPE_SEVERITY)[keyof typeof PPE_SEVERITY];

export const PPE_DETECTION_CLASS = {
  PERSON: "PERSON",
  HARD_HAT: "HARD_HAT",
  SAFETY_VEST: "SAFETY_VEST",
  SAFETY_BOOTS: "SAFETY_BOOTS",
  SAFETY_GLOVES: "SAFETY_GLOVES",
  SAFETY_GOGGLES: "SAFETY_GOGGLES",
  SAFETY_HARNESS: "SAFETY_HARNESS",
} as const;

export type PPEDetectionClass =
  (typeof PPE_DETECTION_CLASS)[keyof typeof PPE_DETECTION_CLASS];

export const KAFKA_CONSUMER_GROUPS = {
  INCIDENT_SERVICE: "ppe-incident-consumer-group",
  NOTIFICATION_SERVICE: "ppe-notification-consumer-group",
  REPORTING_SERVICE: "ppe-reporting-consumer-group",
  AUDIT_LOGGER: "ppe-audit-consumer-group",
} as const;

export type KafkaConsumerGroup =
  (typeof KAFKA_CONSUMER_GROUPS)[keyof typeof KAFKA_CONSUMER_GROUPS];

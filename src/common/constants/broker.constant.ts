import { KAFKA_CONSUMER_GROUPS, KAFKA_TOPICS } from "./kafka.constant";

/**
 * Message Broker & Event Ingestion Constants (Task BE-12)
 *
 * Quản lý tập trung:
 * - Consumer Groups cho các satellite microservices
 * - Topics phân phối sự kiện PPE
 * - Nguồn phát sinh sự kiện (Ingestion Sources)
 * - Trạng thái hàng đợi Dead-Letter Queue (DLQ)
 */

export const BROKER_CONSUMER_GROUPS = {
  INCIDENT_SERVICE: KAFKA_CONSUMER_GROUPS.INCIDENT_SERVICE,
  NOTIFICATION_SERVICE: KAFKA_CONSUMER_GROUPS.NOTIFICATION_SERVICE,
  REPORTING_SERVICE: KAFKA_CONSUMER_GROUPS.REPORTING_SERVICE,
  AUDIT_LOGGER: KAFKA_CONSUMER_GROUPS.AUDIT_LOGGER,
} as const;

export type BrokerConsumerGroup =
  (typeof BROKER_CONSUMER_GROUPS)[keyof typeof BROKER_CONSUMER_GROUPS];

export const BROKER_TOPICS = {
  PPE_VIOLATION_DETECTED: KAFKA_TOPICS.PPE_VIOLATION_DETECTED,
  PPE_INCIDENT_RESOLVED: KAFKA_TOPICS.PPE_INCIDENT_RESOLVED,
  PPE_CAMERA_STATUS_CHANGED: KAFKA_TOPICS.PPE_CAMERA_STATUS_CHANGED,
  PPE_SITE_ALERT_TRIGGERED: KAFKA_TOPICS.PPE_SITE_ALERT_TRIGGERED,
  PPE_DEAD_LETTER_QUEUE: KAFKA_TOPICS.PPE_DEAD_LETTER_QUEUE,
} as const;

export type BrokerTopic = (typeof BROKER_TOPICS)[keyof typeof BROKER_TOPICS];

export const BROKER_INGESTION_SOURCE = {
  AI_INFERENCE_ENGINE: "ai-inference-engine",
  REST_BRIDGE: "rest-ingestion-bridge",
  KAFKA_CLUSTER: "kafka-cluster",
} as const;

export type BrokerIngestionSource =
  (typeof BROKER_INGESTION_SOURCE)[keyof typeof BROKER_INGESTION_SOURCE];

export const BROKER_STATUS = {
  HEALTHY: "HEALTHY",
  DEGRADED: "DEGRADED",
  DISCONNECTED: "DISCONNECTED",
} as const;

export type BrokerStatus = (typeof BROKER_STATUS)[keyof typeof BROKER_STATUS];

export const DLQ_RECORD_STATUS = {
  PENDING: "PENDING",
  REPROCESSED: "REPROCESSED",
  PURGED: "PURGED",
} as const;

export type DlqRecordStatus =
  (typeof DLQ_RECORD_STATUS)[keyof typeof DLQ_RECORD_STATUS];

export const BROKER_LIMITS = {
  MAX_DLQ_MEMORY_ITEMS: 500,
  MAX_PROCESSED_EVENT_CACHE: 10000,
  IDEMPOTENCY_TTL_MS: 24 * 60 * 60 * 1000, // 24 giờ
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

/**
 * Trạng thái tiếp nhận sự kiện từ AI Vision Edge Pipeline (Task BE-15)
 */
export const AI_VISION_INGESTION_STATUS = {
  QUEUED: "QUEUED",
  PROCESSED: "PROCESSED",
  DUPLICATE: "DUPLICATE",
  FAILED: "FAILED",
} as const;

export type AiVisionIngestionStatus =
  (typeof AI_VISION_INGESTION_STATUS)[keyof typeof AI_VISION_INGESTION_STATUS];

export const AI_VISION_MODE = {
  ASYNC: "ASYNC",
  SYNC: "SYNC",
} as const;

export type AiVisionMode =
  (typeof AI_VISION_MODE)[keyof typeof AI_VISION_MODE];


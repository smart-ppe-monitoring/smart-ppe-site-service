import { z } from "zod";
import {
  PPE_VIOLATION_TYPES,
  PPE_SEVERITY,
  PPE_DETECTION_CLASS,
  KAFKA_TOPICS,
} from "../constants/kafka.constant";

/**
 * Zod Schema cho tọa độ Bounding Box (chuẩn hóa tỷ lệ [0, 1] hoặc pixel)
 */
export const ppeBoundingBoxSchema = z.object({
  x: z.number().min(0).describe("Tọa độ góc trên bên trái trục X"),
  y: z.number().min(0).describe("Tọa độ góc trên bên trái trục Y"),
  width: z.number().positive().describe("Chiều rộng bounding box"),
  height: z.number().positive().describe("Chiều cao bounding box"),
});

/**
 * Zod Schema cho từng đối tượng phát hiện được bởi AI Inference Engine
 */
export const ppeDetectionItemSchema = z.object({
  class: z.nativeEnum(PPE_DETECTION_CLASS),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Độ tin cậy của mô hình AI [0.0 - 1.0]"),
  box: ppeBoundingBoxSchema,
  trackId: z.number().int().optional().describe("ID định danh đối tượng qua các frames liên tiếp"),
});

/**
 * Zod Schema cho chi tiết từng hành vi vi phạm an toàn
 */
export const ppeViolationItemSchema = z.object({
  violationType: z.nativeEnum(PPE_VIOLATION_TYPES),
  severity: z.nativeEnum(PPE_SEVERITY),
  description: z.string().min(1).describe("Mô tả vi phạm (VD: Thiếu mũ bảo hộ lao động)"),
  confidence: z.number().min(0).max(1),
  box: ppeBoundingBoxSchema.optional(),
  workerName: z.string().optional().nullable().describe("Tên công nhân nếu nhận diện được qua khuôn mặt"),
  workerId: z.string().optional().nullable().describe("Mã định danh công nhân"),
});

/**
 * ── 1. Schema sự kiện: ppe.violation.detected ─────────────────────────────────
 * Được phát ra bởi Camera / Edge AI Inference Engine khi phát hiện công nhân
 * không trang bị đầy đủ đồ bảo hộ lao động (mũ, áo phản quang, giày, găng tay...)
 */
export const ppeViolationDetectedPayloadSchema = z.object({
  violationId: z.string().uuid().describe("UUIDv7 định danh bản ghi vi phạm"),
  timestamp: z
    .string()
    .datetime()
    .describe("Thời điểm phát hiện vi phạm theo chuẩn ISO 8601"),
  site: z.object({
    id: z.string().describe("ID công trường"),
    code: z.string().min(1).describe("Mã công trường (VD: SITE-HANOI-01)"),
    name: z.string().min(1).describe("Tên công trường"),
  }),
  camera: z.object({
    id: z.string().describe("ID camera"),
    code: z.string().min(1).describe("Mã camera (VD: CAM-GATE-01)"),
    name: z.string().min(1).describe("Tên vị trí camera"),
    zone: z.string().min(1).describe("Khu vực giám sát (VD: Cổng vào khu vực thi công A)"),
  }),
  evidence: z.object({
    snapshotUrl: z.string().url().describe("URL ảnh chụp bằng chứng lưu trên MinIO/R2"),
    clipUrl: z.string().url().optional().describe("URL clip video ngắn 10-15s ghi lại vi phạm"),
    frameResolution: z.object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }),
  }),
  detections: z.array(ppeDetectionItemSchema).default([]),
  violations: z
    .array(ppeViolationItemSchema)
    .min(1, "Sự kiện vi phạm phải có tối thiểu 1 loại vi phạm PPE"),
  summary: z.object({
    totalPersons: z.number().int().min(0),
    totalViolations: z.number().int().min(1),
    highestSeverity: z.nativeEnum(PPE_SEVERITY),
  }),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Envelope bọc ngoài chuẩn hóa cho sự kiện ppe.violation.detected
 */
export const ppeViolationDetectedKafkaEventSchema = z.object({
  eventId: z.string().uuid().describe("UUIDv7 định danh sự kiện"),
  topic: z.literal(KAFKA_TOPICS.PPE_VIOLATION_DETECTED),
  traceId: z.string().min(1).describe("Distributed Tracing Correlation ID (x-request-id)"),
  timestamp: z.number().int().positive().describe("Epoch milliseconds"),
  producer: z.string().min(1).default("ai-inference-engine"),
  payload: ppeViolationDetectedPayloadSchema,
});

/**
 * ── 2. Schema sự kiện: ppe.incident.resolved ──────────────────────────────────
 * Được phát ra bởi Incident Service khi giám sát viên an toàn lao động
 * xác nhận xử lý hoặc đóng vi phạm.
 */
export const ppeIncidentResolvedPayloadSchema = z.object({
  incidentId: z.string().uuid(),
  violationId: z.string().uuid(),
  siteId: z.string(),
  resolvedBy: z.object({
    userId: z.string().uuid(),
    fullName: z.string().min(1),
    role: z.string().min(1),
  }),
  resolutionAction: z.enum([
    "WARNING_ISSUED", // Nhắc nhở tại chỗ
    "EQUIPMENT_PROVIDED", // Bổ sung trang bị PPE
    "SITE_SUSPENSION", // Đình chỉ vào công trường
    "FALSE_POSITIVE", // Cảnh báo giả (AI nhận diện nhầm)
  ]),
  notes: z.string().max(1000).optional(),
  resolvedAt: z.string().datetime(),
});

export const ppeIncidentResolvedKafkaEventSchema = z.object({
  eventId: z.string().uuid(),
  topic: z.literal(KAFKA_TOPICS.PPE_INCIDENT_RESOLVED),
  traceId: z.string().min(1),
  timestamp: z.number().int().positive(),
  producer: z.string().min(1).default("ppe-incident-service"),
  payload: ppeIncidentResolvedPayloadSchema,
});

/**
 * ── 3. Schema sự kiện: ppe.camera.status_changed ──────────────────────────────
 * Được phát ra khi Camera Service hoặc Watchdog phát hiện camera online/offline.
 */
export const ppeCameraStatusChangedPayloadSchema = z.object({
  cameraId: z.string(),
  cameraCode: z.string(),
  siteId: z.string(),
  previousStatus: z.enum(["ONLINE", "OFFLINE", "DEGRADED"]),
  currentStatus: z.enum(["ONLINE", "OFFLINE", "DEGRADED"]),
  reason: z.string().optional(),
  timestamp: z.string().datetime(),
});

export const ppeCameraStatusChangedKafkaEventSchema = z.object({
  eventId: z.string().uuid(),
  topic: z.literal(KAFKA_TOPICS.PPE_CAMERA_STATUS_CHANGED),
  traceId: z.string().min(1),
  timestamp: z.number().int().positive(),
  producer: z.string().min(1).default("ppe-camera-service"),
  payload: ppeCameraStatusChangedPayloadSchema,
});

/**
 * ── 4. Schema sự kiện: ppe.site.alert_triggered ───────────────────────────────
 * Được phát ra khi số lượng vi phạm tại một công trường vượt ngưỡng an toàn.
 */
export const ppeSiteAlertTriggeredPayloadSchema = z.object({
  siteId: z.string(),
  siteCode: z.string(),
  siteName: z.string(),
  alertLevel: z.enum(["WARNING", "CRITICAL"]),
  activeViolationsCount: z.number().int().positive(),
  thresholdLimit: z.number().int().positive(),
  message: z.string().min(1),
  timestamp: z.string().datetime(),
});

export const ppeSiteAlertTriggeredKafkaEventSchema = z.object({
  eventId: z.string().uuid(),
  topic: z.literal(KAFKA_TOPICS.PPE_SITE_ALERT_TRIGGERED),
  traceId: z.string().min(1),
  timestamp: z.number().int().positive(),
  producer: z.string().min(1).default("ppe-monitoring-service"),
  payload: ppeSiteAlertTriggeredPayloadSchema,
});

/**
 * Helper hàm kiểm tra và phân tích cú pháp Kafka Message an toàn
 * Nếu payload sai định dạng, trả về lỗi chi tiết để đưa vào Dead-Letter Queue
 */
export function validateKafkaEvent<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; errors: z.ZodIssue[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}

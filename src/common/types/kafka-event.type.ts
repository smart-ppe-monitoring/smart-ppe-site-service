import { z } from "zod";
import {
  ppeBoundingBoxSchema,
  ppeDetectionItemSchema,
  ppeViolationItemSchema,
  ppeViolationDetectedPayloadSchema,
  ppeViolationDetectedKafkaEventSchema,
  ppeIncidentResolvedPayloadSchema,
  ppeIncidentResolvedKafkaEventSchema,
  ppeCameraStatusChangedPayloadSchema,
  ppeCameraStatusChangedKafkaEventSchema,
  ppeSiteAlertTriggeredPayloadSchema,
  ppeSiteAlertTriggeredKafkaEventSchema,
} from "../validations/kafka-event.schema";
import {
  PPEViolationType,
  PPESeverity,
  PPEDetectionClass,
  KafkaTopic,
} from "../constants/kafka.constant";

export type { PPEViolationType, PPESeverity, PPEDetectionClass, KafkaTopic };

export type PPEBoundingBox = z.infer<typeof ppeBoundingBoxSchema>;
export type PPEDetectionItem = z.infer<typeof ppeDetectionItemSchema>;
export type PPEViolationItem = z.infer<typeof ppeViolationItemSchema>;

export type PPEViolationDetectedPayload = z.infer<
  typeof ppeViolationDetectedPayloadSchema
>;
export type PPEViolationDetectedKafkaEvent = z.infer<
  typeof ppeViolationDetectedKafkaEventSchema
>;

export type PPEIncidentResolvedPayload = z.infer<
  typeof ppeIncidentResolvedPayloadSchema
>;
export type PPEIncidentResolvedKafkaEvent = z.infer<
  typeof ppeIncidentResolvedKafkaEventSchema
>;

export type PPECameraStatusChangedPayload = z.infer<
  typeof ppeCameraStatusChangedPayloadSchema
>;
export type PPECameraStatusChangedKafkaEvent = z.infer<
  typeof ppeCameraStatusChangedKafkaEventSchema
>;

export type PPESiteAlertTriggeredPayload = z.infer<
  typeof ppeSiteAlertTriggeredPayloadSchema
>;
export type PPESiteAlertTriggeredKafkaEvent = z.infer<
  typeof ppeSiteAlertTriggeredKafkaEventSchema
>;

/**
 * Bản đồ tổng hợp Topic -> Payload type tương ứng
 */
export interface KafkaTopicPayloadMap {
  "ppe.violation.detected": PPEViolationDetectedPayload;
  "ppe.incident.resolved": PPEIncidentResolvedPayload;
  "ppe.camera.status_changed": PPECameraStatusChangedPayload;
  "ppe.site.alert_triggered": PPESiteAlertTriggeredPayload;
}

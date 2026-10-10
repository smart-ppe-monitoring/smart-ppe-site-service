import { EventName } from "../constants/event.constant";

// Canonical PPE event types — derived from Zod schemas (single source of truth).
// Import directly from kafka-event.type.ts for full payload access.
export type {
  PPEViolationDetectedPayload,
  PPEIncidentResolvedPayload,
  PPECameraStatusChangedPayload,
  PPESiteAlertTriggeredPayload,
} from "./kafka-event.type";

export interface UserRegisteredPayload {
  userId: string;
  email: string;
  fullName?: string | null;
  verifyToken: string;
}

export interface VerificationRequestedPayload {
  userId: string;
  email: string;
  fullName?: string | null;
  verifyToken: string;
}

export interface PasswordResetRequestedPayload {
  userId: string;
  email: string;
  resetToken: string;
  ip?: string | null;
}

export interface NewDeviceDetectedPayload {
  userId: string;
  email: string;
  deviceName: string;
  ip?: string | null;
}

export interface DeactivationRequestedPayload {
  userId: string;
  email: string;
  fullName?: string | null;
  deactivationToken: string;
}

export interface UserSoftDeletedPayload {
  userId: string;
  deletedBy?: string | null;
  deletedAt: string | Date;
}

export interface FileUploadedUnconfirmedPayload {
  fileId: string;
  key: string;
  bucket: string;
  expiresAt: string | Date;
}

import type {
  PPEViolationDetectedPayload,
  PPEIncidentResolvedPayload,
  PPECameraStatusChangedPayload,
  PPESiteAlertTriggeredPayload,
} from "./kafka-event.type";

export interface PPEIncidentCreatedPayload {
  incidentId: string;
  siteId: string;
  cameraId: string;
  violationType: string;
  severity: string;
  description?: string;
  detectedAt: Date | string;
}

export interface PPEIncidentAssignedPayload {
  incidentId: string;
  assignedTo: string;
  assignedBy?: string;
}

export interface EventPayloadMap {
  "auth.user_registered": UserRegisteredPayload;
  "auth.verification_requested": VerificationRequestedPayload;
  "auth.password_reset_requested": PasswordResetRequestedPayload;
  "auth.new_device_detected": NewDeviceDetectedPayload;
  "auth.deactivation_requested": DeactivationRequestedPayload;
  "user.soft_deleted": UserSoftDeletedPayload;
  "file.uploaded_unconfirmed": FileUploadedUnconfirmedPayload;
  "ppe.violation.detected": PPEViolationDetectedPayload;
  "ppe.incident.created": PPEIncidentCreatedPayload;
  "ppe.incident.assigned": PPEIncidentAssignedPayload;
  "ppe.incident.resolved": PPEIncidentResolvedPayload;
  "ppe.camera.status_changed": PPECameraStatusChangedPayload;
  "ppe.site.alert_triggered": PPESiteAlertTriggeredPayload;
}

export interface EventEnvelope<T = unknown> {
  id: string; // UUIDv7 duy nhất đại diện cho sự kiện
  name: EventName;
  payload: T;
  aggregateId?: string | null;
  timestamp: number;
  traceId?: string;
  source: string;
}

export type EventHandler<T = any> = (
  event: EventEnvelope<T>,
) => Promise<void> | void;

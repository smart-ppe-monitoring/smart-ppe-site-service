/**
 * Trạng thái của một sự cố PPE (Incident)
 * Vòng đời: PENDING_REVIEW -> CONFIRMED hoặc DISMISSED -> RESOLVED -> CLOSED
 */
export const INCIDENT_STATUS = {
  PENDING_REVIEW: "PENDING_REVIEW",
  CONFIRMED: "CONFIRMED",
  DISMISSED: "DISMISSED",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED",
} as const;

export type IncidentStatus =
  (typeof INCIDENT_STATUS)[keyof typeof INCIDENT_STATUS];

/**
 * Loại vi phạm PPE
 */
export const VIOLATION_TYPE = {
  NO_HELMET: "NO_HELMET",
  NO_VEST: "NO_VEST",
  RESTRICTED_AREA: "RESTRICTED_AREA",
  MULTI_VIOLATION: "MULTI_VIOLATION",
} as const;

export type ViolationType =
  (typeof VIOLATION_TYPE)[keyof typeof VIOLATION_TYPE];

/**
 * Mức độ nghiêm trọng của sự cố
 */
export const INCIDENT_SEVERITY = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;

export type IncidentSeverity =
  (typeof INCIDENT_SEVERITY)[keyof typeof INCIDENT_SEVERITY];

/**
 * Loại bằng chứng số đi kèm sự cố
 */
export const EVIDENCE_TYPE = {
  SNAPSHOT: "SNAPSHOT",
  VIDEO_CLIP: "VIDEO_CLIP",
} as const;

export type EvidenceType =
  (typeof EVIDENCE_TYPE)[keyof typeof EVIDENCE_TYPE];

/**
 * Trạng thái phân công xử lý sự cố
 */
export const ASSIGNMENT_STATUS = {
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
} as const;

export type AssignmentStatus =
  (typeof ASSIGNMENT_STATUS)[keyof typeof ASSIGNMENT_STATUS];

/**
 * Hành động truy vết bằng chứng số
 */
export const EVIDENCE_ACCESS_ACTION = {
  VIEW: "VIEW",
  DOWNLOAD: "DOWNLOAD",
} as const;

export type EvidenceAccessAction =
  (typeof EVIDENCE_ACCESS_ACTION)[keyof typeof EVIDENCE_ACCESS_ACTION];

/**
 * Bản đồ các bước chuyển trạng thái hợp lệ trong Incident Lifecycle
 */
export const VALID_INCIDENT_TRANSITIONS: Record<
  IncidentStatus,
  IncidentStatus[]
> = {
  [INCIDENT_STATUS.PENDING_REVIEW]: [
    INCIDENT_STATUS.CONFIRMED,
    INCIDENT_STATUS.DISMISSED,
  ],
  [INCIDENT_STATUS.CONFIRMED]: [INCIDENT_STATUS.RESOLVED],
  [INCIDENT_STATUS.DISMISSED]: [INCIDENT_STATUS.CLOSED],
  [INCIDENT_STATUS.RESOLVED]: [INCIDENT_STATUS.CLOSED],
  [INCIDENT_STATUS.CLOSED]: [],
};

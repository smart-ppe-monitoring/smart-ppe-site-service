/**
 * Constants for Reporting & Analytics Service (Task BE-09)
 */

export const REPORT_TYPE = {
  DAILY: "DAILY",
  WEEKLY: "WEEKLY",
  MONTHLY: "MONTHLY",
  VIOLATION_SUMMARY: "VIOLATION_SUMMARY",
  AI_PERFORMANCE: "AI_PERFORMANCE",
} as const;

export type ReportType = (typeof REPORT_TYPE)[keyof typeof REPORT_TYPE];

export const REPORT_STATUS = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;

export type ReportStatus = (typeof REPORT_STATUS)[keyof typeof REPORT_STATUS];

export const REPORT_FILE_TYPE = {
  PDF: "PDF",
  EXCEL: "EXCEL",
  CSV: "CSV",
  JSON: "JSON",
} as const;

export type ReportFileType =
  (typeof REPORT_FILE_TYPE)[keyof typeof REPORT_FILE_TYPE];

export const REPORT_TEMPLATE_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;

export type ReportTemplateStatus =
  (typeof REPORT_TEMPLATE_STATUS)[keyof typeof REPORT_TEMPLATE_STATUS];

export const AI_MODEL_TYPE = {
  OBJECT_DETECTION: "OBJECT_DETECTION",
  TRACKING: "TRACKING",
  CLASSIFICATION: "CLASSIFICATION",
} as const;

export type AiModelType = (typeof AI_MODEL_TYPE)[keyof typeof AI_MODEL_TYPE];

export const AI_MODEL_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  DEPRECATED: "DEPRECATED",
} as const;

export type AiModelStatus =
  (typeof AI_MODEL_STATUS)[keyof typeof AI_MODEL_STATUS];

export const AI_MODEL_VERSION_STATUS = {
  DEVELOPMENT: "DEVELOPMENT",
  STAGING: "STAGING",
  DEPLOYED: "DEPLOYED",
  ARCHIVED: "ARCHIVED",
} as const;

export type AiModelVersionStatus =
  (typeof AI_MODEL_VERSION_STATUS)[keyof typeof AI_MODEL_VERSION_STATUS];

export const STATISTIC_GROUP_BY = {
  DAY: "DAY",
  WEEK: "WEEK",
  MONTH: "MONTH",
} as const;

export type StatisticGroupBy =
  (typeof STATISTIC_GROUP_BY)[keyof typeof STATISTIC_GROUP_BY];

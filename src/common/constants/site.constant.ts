export const SITE_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  COMPLETED: "COMPLETED",
  ARCHIVED: "ARCHIVED",
} as const;

export type SiteStatus = (typeof SITE_STATUS)[keyof typeof SITE_STATUS];

export const ZONE_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  MAINTENANCE: "MAINTENANCE",
} as const;

export type ZoneStatus = (typeof ZONE_STATUS)[keyof typeof ZONE_STATUS];

export const RESTRICTED_AREA_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;

export type RestrictedAreaStatus =
  (typeof RESTRICTED_AREA_STATUS)[keyof typeof RESTRICTED_AREA_STATUS];

export const DEFAULT_SAFETY_CONFIG = {
  CONFIDENCE_THRESHOLD: 0.8,
  CONFIRMATION_DURATION: 3,
  COOLDOWN_DURATION: 30,
  ENABLE_NO_HELMET: true,
  ENABLE_NO_VEST: true,
  ENABLE_RESTRICTED_AREA: true,

  confidenceThreshold: 0.8,
  confirmationDuration: 3,
  cooldownDuration: 30,
  enableNoHelmet: true,
  enableNoVest: true,
  enableRestrictedArea: true,
} as const;

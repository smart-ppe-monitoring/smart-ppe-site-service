export const DEFAULT_SAFETY_CONFIG = {
  confidenceThreshold: 0.8,
  confirmationDuration: 2, // 2 seconds
  cooldownDuration: 30, // 30 seconds
  enableNoHelmet: true,
  enableNoVest: true,
  enableRestrictedArea: true,
  modelVersionId: null as string | null,
} as const;

export const CONFIG_RESOLUTION_SOURCE = {
  CAMERA_OVERRIDE: "CAMERA_OVERRIDE",
  SITE_LEVEL: "SITE_LEVEL",
  SYSTEM_DEFAULT: "SYSTEM_DEFAULT",
} as const;

export type ConfigResolutionSource =
  (typeof CONFIG_RESOLUTION_SOURCE)[keyof typeof CONFIG_RESOLUTION_SOURCE];

export const SAFETY_RULE_LIMITS = {
  MIN_CONFIDENCE_THRESHOLD: 0.01,
  MAX_CONFIDENCE_THRESHOLD: 0.99,
  MIN_CONFIRMATION_DURATION: 1,
  MAX_CONFIRMATION_DURATION: 60,
  MIN_COOLDOWN_DURATION: 5,
  MAX_COOLDOWN_DURATION: 300,
} as const;

export const SAFETY_RULE_CACHE_CONFIG = {
  DEFAULT_TTL_MS: 60_000, // 60 seconds
  MAX_ENTRIES: 500,
} as const;

/**
 * Hằng số tập trung cho Media & Image Processing Service (Phase 6)
 * Tuân thủ quy chuẩn không hard-code magic strings theo AGENTS.md
 */

export const IMAGE_FORMAT = {
  WEBP: "webp",
  JPEG: "jpeg",
  PNG: "png",
  AVIF: "avif",
} as const;

export type ImageFormat = (typeof IMAGE_FORMAT)[keyof typeof IMAGE_FORMAT];

export const IMAGE_FIT = {
  COVER: "cover",
  CONTAIN: "contain",
  FILL: "fill",
  INSIDE: "inside",
  OUTSIDE: "outside",
} as const;

export type ImageFit = (typeof IMAGE_FIT)[keyof typeof IMAGE_FIT];

export const MEDIA_FOLDER = {
  AVATARS: "avatars",
  THUMBNAILS: "thumbnails",
  GENERAL: "general",
  TRANSFORMED: "transformed",
  IMAGES: "images",
} as const;

export type MediaFolder = (typeof MEDIA_FOLDER)[keyof typeof MEDIA_FOLDER];

export const MEDIA_LIMITS = {
  DEFAULT_QUALITY: 80,
  MIN_QUALITY: 10,
  MAX_QUALITY: 100,
  DEFAULT_AVATAR_SIZE: 256,
  DEFAULT_THUMBNAIL_WIDTH: 300,
  DEFAULT_THUMBNAIL_HEIGHT: 300,
  MIN_DIMENSION: 16,
  MAX_DIMENSION: 4096,
  MAX_FILE_SIZE_BYTES: 15 * 1024 * 1024, // 15MB
  UNCONFIRMED_CLEANUP_HOURS: 24,
  SOFT_DELETED_RETENTION_DAYS: 30,
} as const;

export const SUPPORTED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/tiff",
] as const;

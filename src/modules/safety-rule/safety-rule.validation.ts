import { z } from "zod";
import { SAFETY_RULE_LIMITS } from "./safety-rule.constant";
import { uuidSchema as commonUuidSchema } from "../../common/validations/common.validation";

export const uuidSchema = commonUuidSchema;

export const invalidateCacheSchema = z.object({
  siteId: uuidSchema.optional(),
  cameraId: uuidSchema.optional(),
});

export const siteIdParamSchema = z.object({
  siteId: uuidSchema,
});

export const cameraIdParamSchema = z.object({
  cameraId: uuidSchema,
});

export const updateSiteSafetyConfigSchema = z
  .object({
    confidenceThreshold: z
      .number()
      .min(
        SAFETY_RULE_LIMITS.MIN_CONFIDENCE_THRESHOLD,
        `Ngưỡng độ tin cậy tối thiểu là ${SAFETY_RULE_LIMITS.MIN_CONFIDENCE_THRESHOLD}`,
      )
      .max(
        SAFETY_RULE_LIMITS.MAX_CONFIDENCE_THRESHOLD,
        `Ngưỡng độ tin cậy tối đa là ${SAFETY_RULE_LIMITS.MAX_CONFIDENCE_THRESHOLD}`,
      )
      .optional(),
    confirmationDuration: z
      .number()
      .int()
      .min(
        SAFETY_RULE_LIMITS.MIN_CONFIRMATION_DURATION,
        `Thời gian xác nhận tối thiểu là ${SAFETY_RULE_LIMITS.MIN_CONFIRMATION_DURATION} giây`,
      )
      .max(
        SAFETY_RULE_LIMITS.MAX_CONFIRMATION_DURATION,
        `Thời gian xác nhận tối đa là ${SAFETY_RULE_LIMITS.MAX_CONFIRMATION_DURATION} giây`,
      )
      .optional(),
    cooldownDuration: z
      .number()
      .int()
      .min(
        SAFETY_RULE_LIMITS.MIN_COOLDOWN_DURATION,
        `Thời gian cooldown tối thiểu là ${SAFETY_RULE_LIMITS.MIN_COOLDOWN_DURATION} giây`,
      )
      .max(
        SAFETY_RULE_LIMITS.MAX_COOLDOWN_DURATION,
        `Thời gian cooldown tối đa là ${SAFETY_RULE_LIMITS.MAX_COOLDOWN_DURATION} giây`,
      )
      .optional(),
    enableNoHelmet: z.boolean().optional(),
    enableNoVest: z.boolean().optional(),
    enableRestrictedArea: z.boolean().optional(),
    modelVersionId: uuidSchema.nullable().optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    "Cần cung cấp ít nhất một trường để cập nhật",
  );

export const updateCameraSafetyConfigSchema = z
  .object({
    confidenceThreshold: z
      .number()
      .min(
        SAFETY_RULE_LIMITS.MIN_CONFIDENCE_THRESHOLD,
        `Ngưỡng độ tin cậy tối thiểu là ${SAFETY_RULE_LIMITS.MIN_CONFIDENCE_THRESHOLD}`,
      )
      .max(
        SAFETY_RULE_LIMITS.MAX_CONFIDENCE_THRESHOLD,
        `Ngưỡng độ tin cậy tối đa là ${SAFETY_RULE_LIMITS.MAX_CONFIDENCE_THRESHOLD}`,
      )
      .nullable()
      .optional(),
    confirmationDuration: z
      .number()
      .int()
      .min(
        SAFETY_RULE_LIMITS.MIN_CONFIRMATION_DURATION,
        `Thời gian xác nhận tối thiểu là ${SAFETY_RULE_LIMITS.MIN_CONFIRMATION_DURATION} giây`,
      )
      .max(
        SAFETY_RULE_LIMITS.MAX_CONFIRMATION_DURATION,
        `Thời gian xác nhận tối đa là ${SAFETY_RULE_LIMITS.MAX_CONFIRMATION_DURATION} giây`,
      )
      .nullable()
      .optional(),
    cooldownDuration: z
      .number()
      .int()
      .min(
        SAFETY_RULE_LIMITS.MIN_COOLDOWN_DURATION,
        `Thời gian cooldown tối thiểu là ${SAFETY_RULE_LIMITS.MIN_COOLDOWN_DURATION} giây`,
      )
      .max(
        SAFETY_RULE_LIMITS.MAX_COOLDOWN_DURATION,
        `Thời gian cooldown tối đa là ${SAFETY_RULE_LIMITS.MAX_COOLDOWN_DURATION} giây`,
      )
      .nullable()
      .optional(),
    enableNoHelmet: z.boolean().nullable().optional(),
    enableNoVest: z.boolean().nullable().optional(),
    enableRestrictedArea: z.boolean().nullable().optional(),
    modelVersionId: uuidSchema.nullable().optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    "Cần cung cấp ít nhất một trường để cập nhật",
  );

export const effectiveSafetyConfigQuerySchema = z
  .object({
    siteId: uuidSchema.optional(),
    cameraId: uuidSchema.optional(),
  })
  .refine(
    (data) => !!data.siteId || !!data.cameraId,
    "Cần cung cấp ít nhất siteId hoặc cameraId để tính toán cấu hình hiệu lực",
  );

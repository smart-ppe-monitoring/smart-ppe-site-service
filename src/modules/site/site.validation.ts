import { z } from "zod";
import {
  SITE_STATUS,
  ZONE_STATUS,
  RESTRICTED_AREA_STATUS,
} from "../../common/constants/site.constant";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const uuidSchema = z
  .string()
  .trim()
  .regex(UUID_REGEX, "ID phải là định dạng UUID hợp lệ");

export const siteIdParamSchema = z.object({
  id: uuidSchema,
});

export const zoneIdParamSchema = z.object({
  id: uuidSchema,
});

export const restrictedAreaIdParamSchema = z.object({
  id: uuidSchema,
});

export const siteIdParamOnlySchema = z.object({
  siteId: uuidSchema,
});

const CODE_REGEX = /^[A-Z0-9_-]+$/i;

// ── Site Schemas ─────────────────────────────────────────────────────────────
const siteBaseSchema = z.object({
  name: z
    .string({ required_error: "Tên công trường là bắt buộc" })
    .trim()
    .min(2, "Tên công trường phải có ít nhất 2 ký tự")
    .max(150, "Tên công trường không được vượt quá 150 ký tự"),
  code: z
    .string({ required_error: "Mã công trường là bắt buộc" })
    .trim()
    .min(2, "Mã công trường phải có ít nhất 2 ký tự")
    .max(50, "Mã công trường không được vượt quá 50 ký tự")
    .regex(CODE_REGEX, "Mã công trường chỉ gồm chữ cái, số, gạch dưới và gạch ngang"),
  address: z.string().trim().max(500).optional(),
  description: z.string().trim().max(1000).optional(),
  status: z
    .enum(
      [
        SITE_STATUS.ACTIVE,
        SITE_STATUS.INACTIVE,
        SITE_STATUS.COMPLETED,
        SITE_STATUS.ARCHIVED,
      ],
      { errorMap: () => ({ message: "Trạng thái công trường không hợp lệ" }) },
    )
    .optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày bắt đầu phải theo định dạng YYYY-MM-DD")
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày kết thúc phải theo định dạng YYYY-MM-DD")
    .optional(),
});

export const createSiteSchema = siteBaseSchema.refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.endDate) >= new Date(data.startDate);
    }
    return true;
  },
  {
    message: "Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu",
    path: ["endDate"],
  },
);

export const updateSiteSchema = siteBaseSchema
  .extend({
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày bắt đầu phải theo định dạng YYYY-MM-DD")
      .nullable()
      .optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày kết thúc phải theo định dạng YYYY-MM-DD")
      .nullable()
      .optional(),
  })
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    "Cần cung cấp ít nhất một trường để cập nhật",
  )
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.endDate) >= new Date(data.startDate);
      }
      return true;
    },
    {
      message: "Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu",
      path: ["endDate"],
    },
  );

export const siteQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: z
    .enum([
      SITE_STATUS.ACTIVE,
      SITE_STATUS.INACTIVE,
      SITE_STATUS.COMPLETED,
      SITE_STATUS.ARCHIVED,
    ])
    .optional(),
  sortBy: z.enum(["name", "code", "createdAt", "status"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

// ── Zone Schemas ─────────────────────────────────────────────────────────────
export const createZoneSchema = z.object({
  siteId: uuidSchema.optional(),
  name: z
    .string({ required_error: "Tên phân khu là bắt buộc" })
    .trim()
    .min(2, "Tên phân khu phải có ít nhất 2 ký tự")
    .max(150, "Tên phân khu không được vượt quá 150 ký tự"),
  code: z
    .string({ required_error: "Mã phân khu là bắt buộc" })
    .trim()
    .min(2, "Mã phân khu phải có ít nhất 2 ký tự")
    .max(50, "Mã phân khu không được vượt quá 50 ký tự")
    .regex(CODE_REGEX, "Mã phân khu chỉ gồm chữ cái, số, gạch dưới và gạch ngang"),
  description: z.string().trim().max(1000).optional(),
  status: z
    .enum(
      [
        ZONE_STATUS.ACTIVE,
        ZONE_STATUS.INACTIVE,
        ZONE_STATUS.MAINTENANCE,
      ],
      { errorMap: () => ({ message: "Trạng thái phân khu không hợp lệ" }) },
    )
    .optional(),
});

export const updateZoneSchema = createZoneSchema
  .omit({ siteId: true })
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    "Cần cung cấp ít nhất một trường để cập nhật",
  );

export const zoneQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  siteId: uuidSchema.optional(),
  status: z
    .enum([
      ZONE_STATUS.ACTIVE,
      ZONE_STATUS.INACTIVE,
      ZONE_STATUS.MAINTENANCE,
    ])
    .optional(),
  sortBy: z.enum(["name", "code", "createdAt", "status"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

// ── Safety Config Schemas ────────────────────────────────────────────────────
export const updateSiteSafetyConfigSchema = z
  .object({
    confidenceThreshold: z
      .number()
      .min(0.1, "Ngưỡng tin cậy phải từ 0.10 đến 1.00")
      .max(1.0, "Ngưỡng tin cậy không được vượt quá 1.00")
      .optional(),
    confirmationDuration: z
      .number()
      .int()
      .min(1, "Thời gian xác nhận phải từ 1 đến 60 giây")
      .max(60, "Thời gian xác nhận tối đa 60 giây")
      .optional(),
    cooldownDuration: z
      .number()
      .int()
      .min(5, "Thời gian cooldown phải từ 5 đến 3600 giây")
      .max(3600, "Thời gian cooldown tối đa 3600 giây")
      .optional(),
    enableNoHelmet: z.boolean().optional(),
    enableNoVest: z.boolean().optional(),
    enableRestrictedArea: z.boolean().optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    "Cần cung cấp ít nhất một trường để cập nhật",
  );

// ── Restricted Area Schemas ──────────────────────────────────────────────────
export const polygonPointSchema = z.object({
  x: z
    .number({ required_error: "Tọa độ x là bắt buộc" })
    .finite("Tọa độ x phải là số hữu hạn")
    .min(0, "Tọa độ x không được âm"),
  y: z
    .number({ required_error: "Tọa độ y là bắt buộc" })
    .finite("Tọa độ y phải là số hữu hạn")
    .min(0, "Tọa độ y không được âm"),
});

export const createRestrictedAreaSchema = z.object({
  siteId: uuidSchema.optional(),
  zoneId: uuidSchema.optional(),
  name: z
    .string({ required_error: "Tên vùng hạn chế là bắt buộc" })
    .trim()
    .min(2, "Tên vùng hạn chế phải có ít nhất 2 ký tự")
    .max(150, "Tên vùng hạn chế không được vượt quá 150 ký tự"),
  description: z.string().trim().max(1000).optional(),
  boundary: z
    .array(polygonPointSchema, {
      required_error: "Tọa độ đa giác (boundary) là bắt buộc",
    })
    .min(3, "Đa giác vùng hạn chế phải có tối thiểu 3 điểm tọa độ")
    .max(50, "Đa giác vùng hạn chế không được vượt quá 50 điểm tọa độ"),
  status: z
    .enum([RESTRICTED_AREA_STATUS.ACTIVE, RESTRICTED_AREA_STATUS.INACTIVE], {
      errorMap: () => ({ message: "Trạng thái vùng hạn chế không hợp lệ" }),
    })
    .optional(),
});

export const updateRestrictedAreaSchema = z
  .object({
    zoneId: uuidSchema.nullable().optional(),
    name: z.string().trim().min(2).max(150).optional(),
    description: z.string().trim().max(1000).optional(),
    boundary: z
      .array(polygonPointSchema)
      .min(3, "Đa giác vùng hạn chế phải có tối thiểu 3 điểm tọa độ")
      .max(50, "Đa giác vùng hạn chế không được vượt quá 50 điểm tọa độ")
      .optional(),
    status: z
      .enum([RESTRICTED_AREA_STATUS.ACTIVE, RESTRICTED_AREA_STATUS.INACTIVE])
      .optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    "Cần cung cấp ít nhất một trường để cập nhật",
  );

export const restrictedAreaQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  siteId: uuidSchema.optional(),
  zoneId: uuidSchema.optional(),
  status: z
    .enum([RESTRICTED_AREA_STATUS.ACTIVE, RESTRICTED_AREA_STATUS.INACTIVE])
    .optional(),
  sortBy: z.enum(["name", "createdAt", "status"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export const createZoneDirectSchema = createZoneSchema.extend({
  siteId: uuidSchema,
});

export const createRestrictedAreaDirectSchema = createRestrictedAreaSchema.extend({
  siteId: uuidSchema,
});



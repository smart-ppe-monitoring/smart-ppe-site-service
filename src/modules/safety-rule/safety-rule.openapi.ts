import { openapiRegistry } from "../../config/openapi/openapi.registry";
import {
  siteIdParamSchema,
  cameraIdParamSchema,
  updateSiteSafetyConfigSchema,
  updateCameraSafetyConfigSchema,
  effectiveSafetyConfigQuerySchema,
  invalidateCacheSchema,
} from "./safety-rule.validation";
import { z } from "zod";

export function registerSafetyRuleOpenApi(): void {
  openapiRegistry.register(
    "UpdateSiteSafetyConfigRequest",
    updateSiteSafetyConfigSchema,
  );
  openapiRegistry.register(
    "UpdateCameraSafetyConfigRequest",
    updateCameraSafetyConfigSchema,
  );
  openapiRegistry.register(
    "InvalidateSafetyRuleCacheRequest",
    invalidateCacheSchema,
  );

  // 1. System Default
  openapiRegistry.registerPath({
    method: "get",
    path: "/safety-rules/system-default",
    tags: ["Safety Rules & AI Thresholds"],
    summary: "Lấy cấu hình ngưỡng an toàn mặc định toàn hệ thống",
    security: [{ BearerAuth: [] }],
    responses: {
      200: {
        description: "Lấy cấu hình mặc định thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
    },
  });

  // 2. Effective Configuration Resolution
  openapiRegistry.registerPath({
    method: "get",
    path: "/safety-rules/effective",
    tags: ["Safety Rules & AI Thresholds"],
    summary:
      "Phân giải cấu hình an toàn & AI hiệu lực tức thời (Effective Config Resolution cho AI Pipeline & UI)",
    description:
      "Giải quyết theo thứ bậc ưu tiên: Camera Override -> Site Level -> System Default kèm đa giác vùng cấm và phiên bản mô hình AI.",
    security: [{ BearerAuth: [] }],
    request: { query: effectiveSafetyConfigQuerySchema },
    responses: {
      200: {
        description: "Phân giải cấu hình hiệu lực thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
    },
  });

  // 3. Site Safety Config
  openapiRegistry.registerPath({
    method: "get",
    path: "/safety-rules/sites/{siteId}",
    tags: ["Safety Rules & AI Thresholds"],
    summary: "Lấy cấu hình quy tắc an toàn cấp công trường",
    security: [{ BearerAuth: [] }],
    request: { params: siteIdParamSchema },
    responses: {
      200: {
        description: "Lấy cấu hình công trường thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
    },
  });

  openapiRegistry.registerPath({
    method: "put",
    path: "/safety-rules/sites/{siteId}",
    tags: ["Safety Rules & AI Thresholds"],
    summary: "Cập nhật cấu hình quy tắc an toàn cấp công trường",
    security: [{ BearerAuth: [] }],
    request: {
      params: siteIdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: updateSiteSafetyConfigSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Cập nhật cấu hình thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              message: z.string(),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
    },
  });

  // 4. Camera Safety Config Overrides
  openapiRegistry.registerPath({
    method: "get",
    path: "/safety-rules/cameras/{cameraId}",
    tags: ["Safety Rules & AI Thresholds"],
    summary: "Lấy cấu hình override quy tắc an toàn của camera",
    security: [{ BearerAuth: [] }],
    request: { params: cameraIdParamSchema },
    responses: {
      200: {
        description: "Lấy cấu hình override camera thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
    },
  });

  openapiRegistry.registerPath({
    method: "put",
    path: "/safety-rules/cameras/{cameraId}",
    tags: ["Safety Rules & AI Thresholds"],
    summary: "Cập nhật cấu hình override quy tắc an toàn của camera",
    security: [{ BearerAuth: [] }],
    request: {
      params: cameraIdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: updateCameraSafetyConfigSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Cập nhật override camera thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              message: z.string(),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
    },
  });

  openapiRegistry.registerPath({
    method: "delete",
    path: "/safety-rules/cameras/{cameraId}",
    tags: ["Safety Rules & AI Thresholds"],
    summary:
      "Xóa cấu hình override của camera (quay về kế thừa từ công trường)",
    security: [{ BearerAuth: [] }],
    request: { params: cameraIdParamSchema },
    responses: {
      200: {
        description: "Xóa override camera thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              message: z.string(),
            }),
          },
        },
      },
    },
  });

  // 5. Invalidate Cache
  openapiRegistry.registerPath({
    method: "post",
    path: "/safety-rules/cache/invalidate",
    tags: ["Safety Rules & AI Thresholds"],
    summary: "Xóa bộ nhớ đệm cấu hình quy tắc an toàn (In-Memory Cache Invalidation)",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: invalidateCacheSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Xóa bộ nhớ đệm thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              message: z.string(),
            }),
          },
        },
      },
    },
  });
}

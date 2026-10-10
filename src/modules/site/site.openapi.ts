import { openapiRegistry } from "../../config/openapi/openapi.registry";
import {
  createSiteSchema,
  updateSiteSchema,
  siteQuerySchema,
  siteIdParamSchema,
  createZoneSchema,
  createZoneDirectSchema,
  updateZoneSchema,
  zoneQuerySchema,
  zoneIdParamSchema,
  updateSiteSafetyConfigSchema,
  createRestrictedAreaSchema,
  createRestrictedAreaDirectSchema,
  updateRestrictedAreaSchema,
  restrictedAreaQuerySchema,
  restrictedAreaIdParamSchema,
} from "./site.validation";
import { z } from "zod";

const createSiteZoneSchema = createZoneSchema.omit({ siteId: true });
const createSiteRestrictedAreaSchema = createRestrictedAreaSchema.omit({ siteId: true });

export function registerSiteOpenApi(): void {
  openapiRegistry.register("CreateSiteRequest", createSiteSchema);
  openapiRegistry.register("UpdateSiteRequest", updateSiteSchema);
  openapiRegistry.register("UpdateSafetyConfigRequest", updateSiteSafetyConfigSchema);
  openapiRegistry.register("CreateZoneRequest", createZoneDirectSchema);
  openapiRegistry.register("CreateSiteZoneRequest", createSiteZoneSchema);
  openapiRegistry.register("UpdateZoneRequest", updateZoneSchema);
  openapiRegistry.register("CreateRestrictedAreaRequest", createRestrictedAreaDirectSchema);
  openapiRegistry.register("CreateSiteRestrictedAreaRequest", createSiteRestrictedAreaSchema);
  openapiRegistry.register("UpdateRestrictedAreaRequest", updateRestrictedAreaSchema);

  // ── Sites ──────────────────────────────────────────────────────────────────
  openapiRegistry.registerPath({
    method: "get",
    path: "/sites",
    tags: ["Sites"],
    summary: "Danh sách công trường (có phân trang & tìm kiếm)",
    security: [{ BearerAuth: [] }],
    request: { query: siteQuerySchema },
    responses: {
      200: {
        description: "Lấy danh sách công trường thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              data: z.array(z.any()),
              meta: z.object({
                total: z.number(),
                page: z.number(),
                limit: z.number(),
                totalPages: z.number(),
              }),
            }),
          },
        },
      },
    },
  });

  openapiRegistry.registerPath({
    method: "post",
    path: "/sites",
    tags: ["Sites"],
    summary: "Tạo công trường mới",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": { schema: createSiteSchema },
        },
      },
    },
    responses: {
      201: {
        description: "Tạo công trường thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              data: z.any(),
            }),
          },
        },
      },
    },
  });

  openapiRegistry.registerPath({
    method: "get",
    path: "/sites/{id}",
    tags: ["Sites"],
    summary: "Xem chi tiết công trường theo ID",
    security: [{ BearerAuth: [] }],
    request: { params: siteIdParamSchema },
    responses: {
      200: {
        description: "Lấy chi tiết công trường thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              data: z.any(),
            }),
          },
        },
      },
    },
  });

  openapiRegistry.registerPath({
    method: "put",
    path: "/sites/{id}",
    tags: ["Sites"],
    summary: "Cập nhật thông tin công trường",
    security: [{ BearerAuth: [] }],
    request: {
      params: siteIdParamSchema,
      body: {
        content: {
          "application/json": { schema: updateSiteSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Cập nhật công trường thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              data: z.any(),
            }),
          },
        },
      },
    },
  });

  openapiRegistry.registerPath({
    method: "delete",
    path: "/sites/{id}",
    tags: ["Sites"],
    summary: "Xóa công trường",
    security: [{ BearerAuth: [] }],
    request: { params: siteIdParamSchema },
    responses: {
      200: {
        description: "Xóa công trường thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              data: z.any(),
            }),
          },
        },
      },
    },
  });

  // Safety Config
  openapiRegistry.registerPath({
    method: "get",
    path: "/sites/{id}/safety-config",
    tags: ["Sites"],
    summary: "Xem cấu hình an toàn & ngưỡng AI của công trường",
    security: [{ BearerAuth: [] }],
    request: { params: siteIdParamSchema },
    responses: {
      200: {
        description: "Lấy cấu hình an toàn thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              data: z.any(),
            }),
          },
        },
      },
    },
  });

  openapiRegistry.registerPath({
    method: "put",
    path: "/sites/{id}/safety-config",
    tags: ["Sites"],
    summary: "Cập nhật cấu hình an toàn & ngưỡng AI của công trường",
    security: [{ BearerAuth: [] }],
    request: {
      params: siteIdParamSchema,
      body: {
        content: {
          "application/json": { schema: updateSiteSafetyConfigSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Cập nhật cấu hình an toàn thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              data: z.any(),
            }),
          },
        },
      },
    },
  });

  // Nested Site Zones
  openapiRegistry.registerPath({
    method: "get",
    path: "/sites/{id}/zones",
    tags: ["Sites"],
    summary: "Danh sách phân khu thuộc công trường",
    security: [{ BearerAuth: [] }],
    request: {
      params: siteIdParamSchema,
      query: zoneQuerySchema,
    },
    responses: {
      200: {
        description: "Lấy danh sách phân khu thuộc công trường thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              data: z.array(z.any()),
              meta: z.object({
                total: z.number(),
                page: z.number(),
                limit: z.number(),
                totalPages: z.number(),
              }),
            }),
          },
        },
      },
    },
  });

  openapiRegistry.registerPath({
    method: "post",
    path: "/sites/{id}/zones",
    tags: ["Sites"],
    summary: "Tạo phân khu mới thuộc công trường",
    security: [{ BearerAuth: [] }],
    request: {
      params: siteIdParamSchema,
      body: {
        content: {
          "application/json": { schema: createSiteZoneSchema },
        },
      },
    },
    responses: {
      201: {
        description: "Tạo phân khu thuộc công trường thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              data: z.any(),
            }),
          },
        },
      },
    },
  });

  // Nested Site Restricted Areas
  openapiRegistry.registerPath({
    method: "get",
    path: "/sites/{id}/restricted-areas",
    tags: ["Sites"],
    summary: "Danh sách vùng hạn chế nguy hiểm thuộc công trường",
    security: [{ BearerAuth: [] }],
    request: {
      params: siteIdParamSchema,
      query: restrictedAreaQuerySchema,
    },
    responses: {
      200: {
        description: "Lấy danh sách vùng hạn chế thuộc công trường thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              data: z.array(z.any()),
              meta: z.object({
                total: z.number(),
                page: z.number(),
                limit: z.number(),
                totalPages: z.number(),
              }),
            }),
          },
        },
      },
    },
  });

  openapiRegistry.registerPath({
    method: "post",
    path: "/sites/{id}/restricted-areas",
    tags: ["Sites"],
    summary: "Tạo vùng hạn chế mới thuộc công trường",
    security: [{ BearerAuth: [] }],
    request: {
      params: siteIdParamSchema,
      body: {
        content: {
          "application/json": { schema: createSiteRestrictedAreaSchema },
        },
      },
    },
    responses: {
      201: {
        description: "Tạo vùng hạn chế thuộc công trường thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              data: z.any(),
            }),
          },
        },
      },
    },
  });

  // ── Zones ──────────────────────────────────────────────────────────────────
  openapiRegistry.registerPath({
    method: "get",
    path: "/zones",
    tags: ["Zones"],
    summary: "Danh sách phân khu",
    security: [{ BearerAuth: [] }],
    request: { query: zoneQuerySchema },
    responses: {
      200: {
        description: "Lấy danh sách phân khu thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              data: z.array(z.any()),
              meta: z.object({
                total: z.number(),
                page: z.number(),
                limit: z.number(),
                totalPages: z.number(),
              }),
            }),
          },
        },
      },
    },
  });

  openapiRegistry.registerPath({
    method: "post",
    path: "/zones",
    tags: ["Zones"],
    summary: "Tạo phân khu mới",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": { schema: createZoneDirectSchema },
        },
      },
    },
    responses: {
      201: {
        description: "Tạo phân khu thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              data: z.any(),
            }),
          },
        },
      },
    },
  });

  openapiRegistry.registerPath({
    method: "get",
    path: "/zones/{id}",
    tags: ["Zones"],
    summary: "Chi tiết phân khu",
    security: [{ BearerAuth: [] }],
    request: { params: zoneIdParamSchema },
    responses: {
      200: {
        description: "Lấy chi tiết phân khu thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              data: z.any(),
            }),
          },
        },
      },
    },
  });

  openapiRegistry.registerPath({
    method: "put",
    path: "/zones/{id}",
    tags: ["Zones"],
    summary: "Cập nhật phân khu",
    security: [{ BearerAuth: [] }],
    request: {
      params: zoneIdParamSchema,
      body: {
        content: {
          "application/json": { schema: updateZoneSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Cập nhật phân khu thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              data: z.any(),
            }),
          },
        },
      },
    },
  });

  openapiRegistry.registerPath({
    method: "delete",
    path: "/zones/{id}",
    tags: ["Zones"],
    summary: "Xóa phân khu",
    security: [{ BearerAuth: [] }],
    request: { params: zoneIdParamSchema },
    responses: {
      200: {
        description: "Xóa phân khu thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              data: z.any(),
            }),
          },
        },
      },
    },
  });

  openapiRegistry.registerPath({
    method: "get",
    path: "/zones/{id}/restricted-areas",
    tags: ["Zones"],
    summary: "Danh sách vùng hạn chế thuộc phân khu",
    security: [{ BearerAuth: [] }],
    request: {
      params: zoneIdParamSchema,
      query: restrictedAreaQuerySchema,
    },
    responses: {
      200: {
        description: "Lấy danh sách vùng hạn chế thuộc phân khu thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              data: z.array(z.any()),
              meta: z.object({
                total: z.number(),
                page: z.number(),
                limit: z.number(),
                totalPages: z.number(),
              }),
            }),
          },
        },
      },
    },
  });

  // ── Restricted Areas ────────────────────────────────────────────────────────
  openapiRegistry.registerPath({
    method: "get",
    path: "/restricted-areas",
    tags: ["Restricted Areas"],
    summary: "Danh sách vùng hạn chế nguy hiểm",
    security: [{ BearerAuth: [] }],
    request: { query: restrictedAreaQuerySchema },
    responses: {
      200: {
        description: "Lấy danh sách vùng hạn chế thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              data: z.array(z.any()),
              meta: z.object({
                total: z.number(),
                page: z.number(),
                limit: z.number(),
                totalPages: z.number(),
              }),
            }),
          },
        },
      },
    },
  });

  openapiRegistry.registerPath({
    method: "post",
    path: "/restricted-areas",
    tags: ["Restricted Areas"],
    summary: "Tạo vùng hạn chế nguy hiểm mới",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": { schema: createRestrictedAreaDirectSchema },
        },
      },
    },
    responses: {
      201: {
        description: "Tạo vùng hạn chế thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              data: z.any(),
            }),
          },
        },
      },
    },
  });

  openapiRegistry.registerPath({
    method: "get",
    path: "/restricted-areas/{id}",
    tags: ["Restricted Areas"],
    summary: "Chi tiết vùng hạn chế",
    security: [{ BearerAuth: [] }],
    request: { params: restrictedAreaIdParamSchema },
    responses: {
      200: {
        description: "Lấy chi tiết vùng hạn chế thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              data: z.any(),
            }),
          },
        },
      },
    },
  });

  openapiRegistry.registerPath({
    method: "put",
    path: "/restricted-areas/{id}",
    tags: ["Restricted Areas"],
    summary: "Cập nhật vùng hạn chế",
    security: [{ BearerAuth: [] }],
    request: {
      params: restrictedAreaIdParamSchema,
      body: {
        content: {
          "application/json": { schema: updateRestrictedAreaSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Cập nhật vùng hạn chế thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              data: z.any(),
            }),
          },
        },
      },
    },
  });

  openapiRegistry.registerPath({
    method: "delete",
    path: "/restricted-areas/{id}",
    tags: ["Restricted Areas"],
    summary: "Xóa vùng hạn chế",
    security: [{ BearerAuth: [] }],
    request: { params: restrictedAreaIdParamSchema },
    responses: {
      200: {
        description: "Xóa vùng hạn chế thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              data: z.any(),
            }),
          },
        },
      },
    },
  });
}

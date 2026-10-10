import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SITE_STATUS,
  ZONE_STATUS,
  RESTRICTED_AREA_STATUS,
  DEFAULT_SAFETY_CONFIG,
} from "../src/common/constants/site.constant";
import {
  createSiteSchema,
  updateSiteSchema,
  siteQuerySchema,
  createZoneSchema,
  updateZoneSchema,
  updateSiteSafetyConfigSchema,
  createRestrictedAreaSchema,
} from "../src/modules/site/site.validation";
import { SiteService } from "../src/modules/site/site.service";
import { SiteRepository } from "../src/modules/site/site.repository";
import { AppError } from "../src/common/errors/app-error";
import { ERROR_CODE } from "../src/common/errors/error-code";
import { PERMISSIONS } from "../src/common/constants/permission.constant";
import siteApp from "../src/site.app";

describe("Task BE-04: PPE Site Management Service Suite", () => {
  // ── 1. Constants & Status Domain ───────────────────────────────────────────
  describe("1. Site Domain Constants & Taxonomy", () => {
    it("should define standard site, zone, and restricted area status constants", () => {
      assert.equal(SITE_STATUS.ACTIVE, "ACTIVE");
      assert.equal(SITE_STATUS.INACTIVE, "INACTIVE");
      assert.equal(SITE_STATUS.COMPLETED, "COMPLETED");
      assert.equal(SITE_STATUS.ARCHIVED, "ARCHIVED");

      assert.equal(ZONE_STATUS.ACTIVE, "ACTIVE");
      assert.equal(ZONE_STATUS.INACTIVE, "INACTIVE");
      assert.equal(ZONE_STATUS.MAINTENANCE, "MAINTENANCE");

      assert.equal(RESTRICTED_AREA_STATUS.ACTIVE, "ACTIVE");
      assert.equal(RESTRICTED_AREA_STATUS.INACTIVE, "INACTIVE");
    });

    it("should export baseline default safety config parameters", () => {
      assert.equal(DEFAULT_SAFETY_CONFIG.CONFIDENCE_THRESHOLD, 0.8);
      assert.equal(DEFAULT_SAFETY_CONFIG.CONFIRMATION_DURATION, 3);
      assert.equal(DEFAULT_SAFETY_CONFIG.COOLDOWN_DURATION, 30);
      assert.equal(DEFAULT_SAFETY_CONFIG.ENABLE_NO_HELMET, true);
      assert.equal(DEFAULT_SAFETY_CONFIG.ENABLE_NO_VEST, true);
      assert.equal(DEFAULT_SAFETY_CONFIG.ENABLE_RESTRICTED_AREA, true);
    });

    it("should define PPE site-related permissions in PERMISSIONS constant", () => {
      assert.equal(PERMISSIONS.PPE_SITE_READ, "PPE_SITE_READ");
      assert.equal(PERMISSIONS.PPE_SITE_MANAGE, "PPE_SITE_MANAGE");
      assert.equal(PERMISSIONS.PPE_ZONE_READ, "PPE_ZONE_READ");
      assert.equal(PERMISSIONS.PPE_ZONE_MANAGE, "PPE_ZONE_MANAGE");
      assert.equal(PERMISSIONS.PPE_SAFETY_CONFIG_READ, "PPE_SAFETY_CONFIG_READ");
      assert.equal(PERMISSIONS.PPE_SAFETY_CONFIG_MANAGE, "PPE_SAFETY_CONFIG_MANAGE");
      assert.equal(PERMISSIONS.PPE_RESTRICTED_AREA_READ, "PPE_RESTRICTED_AREA_READ");
      assert.equal(PERMISSIONS.PPE_RESTRICTED_AREA_MANAGE, "PPE_RESTRICTED_AREA_MANAGE");
    });
  });

  // ── 2. Zod Validation Schemas ──────────────────────────────────────────────
  describe("2. Request Validation Schemas", () => {
    it("should validate valid site creation payload", () => {
      const validPayload = {
        name: "Công trường Landmark 81",
        code: "LM-81",
        address: "720A Điện Biên Phủ, Phường 22, Bình Thạnh",
        description: "Dự án giám sát an toàn thi công",
        status: SITE_STATUS.ACTIVE,
        startDate: "2026-01-01",
        endDate: "2026-12-31",
      };
      const result = createSiteSchema.safeParse(validPayload);
      assert.equal(result.success, true);
    });

    it("should reject invalid site code containing illegal characters", () => {
      const invalidPayload = {
        name: "Công trường Sai Mã",
        code: "CODE WITH SPACES & SPECIAL @!",
      };
      const result = createSiteSchema.safeParse(invalidPayload);
      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(
          result.error.errors.some((e) =>
            e.message.includes("Mã công trường chỉ gồm"),
          ),
        );
      }
    });

    it("should enforce polygon with at least 3 vertices for restricted areas", () => {
      const invalidArea = {
        name: "Vùng hố móng sâu",
        boundary: [
          { x: 10, y: 20 },
          { x: 20, y: 30 },
        ], // Chỉ có 2 điểm -> không tạo được đa giác khép kín
      };
      const result = createRestrictedAreaSchema.safeParse(invalidArea);
      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(
          result.error.errors.some((e) =>
            e.message.includes("tối thiểu 3 điểm tọa độ"),
          ),
        );
      }

      const validArea = {
        name: "Vùng hố móng sâu",
        boundary: [
          { x: 10, y: 20 },
          { x: 20, y: 30 },
          { x: 30, y: 10 },
        ],
      };
      const validResult = createRestrictedAreaSchema.safeParse(validArea);
      assert.equal(validResult.success, true);
    });

    it("should enforce safety config range limits", () => {
      const invalidThreshold = {
        confidenceThreshold: 1.5, // > 1.0
      };
      const result = updateSiteSafetyConfigSchema.safeParse(invalidThreshold);
      assert.equal(result.success, false);

      const validConfig = {
        confidenceThreshold: 0.85,
        confirmationDuration: 5,
        cooldownDuration: 45,
        enableNoHelmet: true,
      };
      const validResult = updateSiteSafetyConfigSchema.safeParse(validConfig);
      assert.equal(validResult.success, true);
    });

    it("should reject site creation when endDate is before startDate", () => {
      const invalidDates = {
        name: "Công trường Sai Ngày",
        code: "INVALID-DATES",
        startDate: "2026-12-31",
        endDate: "2026-01-01",
      };
      const result = createSiteSchema.safeParse(invalidDates);
      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(
          result.error.errors.some((e) =>
            e.message.includes("Ngày kết thúc phải lớn hơn"),
          ),
        );
      }
    });

    it("should allow clearing dates with null and reject empty update payload in updateSiteSchema", () => {
      // Cho phép null để clear date
      const clearDatePayload = {
        endDate: null,
      };
      const result = updateSiteSchema.safeParse(clearDatePayload);
      assert.equal(result.success, true);

      // Chặn empty payload {}
      const emptyPayload = {};
      const emptyResult = updateSiteSchema.safeParse(emptyPayload);
      assert.equal(emptyResult.success, false);
      if (!emptyResult.success) {
        assert.ok(
          emptyResult.error.errors.some((e) =>
            e.message.includes("ít nhất một trường"),
          ),
        );
      }
    });

    it("should reject polygon with negative coords or exceeding 50 vertices", () => {
      const negativePointArea = {
        name: "Vùng Tọa Độ Âm",
        boundary: [
          { x: -5, y: 10 },
          { x: 10, y: 20 },
          { x: 20, y: 0 },
        ],
      };
      const negativeResult = createRestrictedAreaSchema.safeParse(negativePointArea);
      assert.equal(negativeResult.success, false);

      const tooManyPoints = Array.from({ length: 55 }, (_, i) => ({
        x: i,
        y: i,
      }));
      const excessArea = {
        name: "Vùng Quá Nhiều Điểm",
        boundary: tooManyPoints,
      };
      const excessResult = createRestrictedAreaSchema.safeParse(excessArea);
      assert.equal(excessResult.success, false);
      if (!excessResult.success) {
        assert.ok(
          excessResult.error.errors.some((e) =>
            e.message.includes("không được vượt quá 50"),
          ),
        );
      }
    });
  });

  // ── 3. Site Service Business Logic (Mocked Repository) ─────────────────────
  describe("3. Site Service Business Rules & Hierarchy Checks", () => {
    it("should throw DUPLICATE_ENTRY when creating a site with duplicate code", async () => {
      const mockRepo = {
        findSiteByCode: async (code: string) => ({
          id: "site-uuid-1",
          name: "Site 1",
          code: code.toUpperCase(),
        }),
      } as unknown as SiteRepository;

      const service = new SiteService(mockRepo);

      await assert.rejects(
        async () => {
          await service.createSite({
            name: "Duplicate Site",
            code: "SITE-01",
          });
        },
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 409);
          assert.equal(err.code, ERROR_CODE.DUPLICATE_ENTRY);
          return true;
        },
      );
    });

    it("should throw NOT_FOUND when querying a non-existent site", async () => {
      const mockRepo = {
        findSiteById: async (_id: string) => null,
      } as unknown as SiteRepository;

      const service = new SiteService(mockRepo);

      await assert.rejects(
        async () => {
          await service.findSiteById("00000000-0000-0000-0000-000000000000");
        },
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 404);
          assert.equal(err.code, ERROR_CODE.NOT_FOUND);
          return true;
        },
      );
    });

    it("should prevent assigning restricted area to zone of a different site", async () => {
      const mockRepo = {
        findSiteById: async (id: string) => ({ id, name: "Site A" }),
        findZoneById: async (id: string) => ({
          id,
          siteId: "other-site-uuid", // Phân khu thuộc site khác!
          name: "Zone In Different Site",
        }),
      } as unknown as SiteRepository;

      const service = new SiteService(mockRepo);

      await assert.rejects(
        async () => {
          await service.createRestrictedArea({
            siteId: "my-site-uuid",
            zoneId: "zone-different-site",
            name: "Danger Zone",
            boundary: [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
              { x: 10, y: 10 },
            ],
          });
        },
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, ERROR_CODE.VALIDATION_ERROR);
          assert.ok(err.message.includes("không thuộc công trường"));
          return true;
        },
      );
    });

    it("should auto-provision default safety config when fetching non-existent config", async () => {
      let upsertCalled = false;
      const mockRepo = {
        findSiteById: async (id: string) => ({ id, name: "Site A" }),
        findSafetyConfigBySiteId: async (_id: string) => null,
        upsertSafetyConfig: async (siteId: string, data: any) => {
          upsertCalled = true;
          return {
            id: "config-uuid-1",
            siteId,
            ...data,
          };
        },
      } as unknown as SiteRepository;

      const service = new SiteService(mockRepo);
      const config = await service.getSafetyConfig("site-uuid-1");

      assert.equal(upsertCalled, true);
      assert.equal(config.confidenceThreshold, 0.8);
      assert.equal(config.confirmationDuration, 3);
      assert.equal(config.enableNoHelmet, true);
    });

    it("should resolve zone and query restricted areas in findRestrictedAreasByZone", async () => {
      let queriedParams: any = null;
      const mockRepo = {
        findZoneById: async (id: string) => ({
          id,
          siteId: "parent-site-id",
          name: "Zone 1",
          code: "Z-01",
        }),
        findAllRestrictedAreas: async (query: any) => {
          queriedParams = query;
          return {
            data: [{ id: "ra-1", name: "Restricted Area 1", zoneId: query.zoneId }],
            meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
          };
        },
      } as unknown as SiteRepository;

      const service = new SiteService(mockRepo);
      const result = await service.findRestrictedAreasByZone("zone-1", { page: 1, limit: 10 });

      assert.equal(queriedParams.siteId, "parent-site-id");
      assert.equal(queriedParams.zoneId, "zone-1");
      assert.equal(result.data.length, 1);
    });
  });

  // ── 4. Standalone Express App & Routes Architecture ────────────────────────
  describe("4. Standalone Microservice Express Runtime & Health Checks", () => {
    it("should export initialized Express application for site microservice", () => {
      assert.ok(siteApp);
      assert.equal(typeof siteApp.listen, "function");
      assert.equal(typeof siteApp.use, "function");
    });

    it("should register health check endpoints on siteApp", () => {
      const routes = (siteApp._router?.stack || [])
        .filter((layer: any) => layer.route)
        .map((layer: any) => layer.route.path);

      assert.ok(routes.includes("/health"));
      assert.ok(routes.includes("/api/v1/sites/health"));
      assert.ok(routes.includes("/sites/health"));
    });
  });

  // ── 5. Router Structure & Route Contracts ──────────────────────────────────
  describe("5. Router Endpoints & Permission Protection", () => {
    it("should have correct routes configured for siteRouter", async () => {
      const { siteRouter } = await import("../src/modules/site/site.route");
      const routePaths = siteRouter.stack
        .filter((layer: any) => layer.route)
        .map((layer: any) => layer.route.path);

      assert.ok(routePaths.includes("/"));
      assert.ok(routePaths.includes("/:id"));
      assert.ok(routePaths.includes("/:id/safety-config"));
      assert.ok(routePaths.includes("/:id/zones"));
      assert.ok(routePaths.includes("/:id/restricted-areas"));
    });

    it("should have correct routes configured for zoneRouter", async () => {
      const { zoneRouter } = await import("../src/modules/site/site.route");
      const routePaths = zoneRouter.stack
        .filter((layer: any) => layer.route)
        .map((layer: any) => layer.route.path);

      assert.ok(routePaths.includes("/"));
      assert.ok(routePaths.includes("/:id"));
      assert.ok(routePaths.includes("/:id/restricted-areas"));
    });

    it("should have correct routes configured for restrictedAreaRouter", async () => {
      const { restrictedAreaRouter } = await import(
        "../src/modules/site/site.route"
      );
      const routePaths = restrictedAreaRouter.stack
        .filter((layer: any) => layer.route)
        .map((layer: any) => layer.route.path);

      assert.ok(routePaths.includes("/"));
      assert.ok(routePaths.includes("/:id"));
    });
  });
});


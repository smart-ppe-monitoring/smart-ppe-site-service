import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { Request, Response } from "express";
import { requirePermission, requireAnyPermission } from "../src/middlewares/permission.middleware";
import { authMiddleware } from "../src/middlewares/auth.middleware";
import { jwtConfig } from "../src/config/jwt.config";
import { SiteService } from "../src/modules/site/site.service";
import { SiteRepository } from "../src/modules/site/site.repository";
import { SafetyRuleService } from "../src/modules/safety-rule/safety-rule.service";
import { SafetyRuleCacheService } from "../src/modules/safety-rule/safety-rule-cache.service";
import { updateSiteSafetyConfigSchema } from "../src/modules/site/site.validation";
import fs from "node:fs";
import path from "node:path";
import { AppError } from "../src/common/errors/app-error";
import { ERROR_CODE } from "../src/common/errors/error-code";
import { PERMISSIONS } from "../src/common/constants/permission.constant";
import { ROLES } from "../src/common/constants/role.constant";
import { JWT_PURPOSE, JWT_ALGORITHM } from "../src/common/constants/jwt.constant";

describe("Security Patches Regression Suite (SEC-01, SEC-02, SEC-03)", () => {
  let privateKey: string;
  let publicKey: string;

  before(() => {
    const keyPair = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    privateKey = keyPair.privateKey;
    publicKey = keyPair.publicKey;
    jwtConfig.publicKey = publicKey;
  });

  // ── SEC-01: Admin API Key Scoping Bypass ───────────────────────────────────
  describe("SEC-01: API-KEY-ADMIN-OWNER-PERMISSION-SCOPING-BYPASS", () => {
    it("should reject Admin-owned API key when API key lacks required permission", () => {
      const req = {
        user: {
          id: "admin-uuid",
          email: "admin@example.com",
          role: ROLES.ADMIN,
        },
        apiKey: {
          key: "ak_live_scoped",
          permissions: [PERMISSIONS.PPE_SITE_READ], // Read-only scoped API key
        },
      } as unknown as Request;

      let caughtError: any = null;
      const next = (err?: any) => {
        caughtError = err;
      };

      const middleware = requirePermission(PERMISSIONS.PPE_SITE_MANAGE);
      middleware(req, {} as Response, next);

      assert.ok(caughtError instanceof AppError);
      assert.equal(caughtError.statusCode, 403);
      assert.equal(caughtError.code, ERROR_CODE.FORBIDDEN);
    });

    it("should reject Admin-owned API key in requireAnyPermission when API key lacks permissions", () => {
      const req = {
        user: {
          id: "admin-uuid",
          email: "admin@example.com",
          role: ROLES.ADMIN,
        },
        apiKey: {
          key: "ak_live_scoped",
          permissions: [PERMISSIONS.PPE_SITE_READ],
        },
      } as unknown as Request;

      let caughtError: any = null;
      const next = (err?: any) => {
        caughtError = err;
      };

      const middleware = requireAnyPermission(
        PERMISSIONS.PPE_SITE_MANAGE,
        PERMISSIONS.PPE_SAFETY_CONFIG_MANAGE,
      );
      middleware(req, {} as Response, next);

      assert.ok(caughtError instanceof AppError);
      assert.equal(caughtError.statusCode, 403);
      assert.equal(caughtError.code, ERROR_CODE.FORBIDDEN);
    });

    it("should permit Admin-owned API key when API key has required permission", () => {
      const req = {
        user: {
          id: "admin-uuid",
          email: "admin@example.com",
          role: ROLES.ADMIN,
        },
        apiKey: {
          key: "ak_live_manage",
          permissions: [PERMISSIONS.PPE_SITE_MANAGE],
        },
      } as unknown as Request;

      let called = false;
      let caughtError: any = null;
      const next = (err?: any) => {
        called = true;
        caughtError = err;
      };

      const middleware = requirePermission(PERMISSIONS.PPE_SITE_MANAGE);
      middleware(req, {} as Response, next);

      assert.equal(called, true);
      assert.equal(caughtError, undefined);
    });

    it("should allow Admin user WITHOUT API key to bypass role permission check", () => {
      const req = {
        user: {
          id: "admin-uuid",
          email: "admin@example.com",
          role: ROLES.ADMIN,
        },
        apiKey: undefined,
      } as unknown as Request;

      let called = false;
      let caughtError: any = null;
      const next = (err?: any) => {
        called = true;
        caughtError = err;
      };

      const middleware = requirePermission(PERMISSIONS.PPE_SITE_MANAGE);
      middleware(req, {} as Response, next);

      assert.equal(called, true);
      assert.equal(caughtError, undefined);
    });
  });

  // ── SEC-02: 2FA Purpose Isolation Bypass ──────────────────────────────────
  describe("SEC-02: AUTH-2FA-PURPOSE-ISOLATION-BYPASS", () => {
    it("should reject token with purpose '2FA_VERIFICATION' on business API", async () => {
      const twoFaToken = jwt.sign(
        {
          sub: "user-uuid",
          email: "user@example.com",
          role: ROLES.SAFETY_MANAGER,
          purpose: "2FA_VERIFICATION",
        },
        privateKey,
        { algorithm: "RS256", expiresIn: "5m" },
      );

      const req = {
        headers: {
          authorization: `Bearer ${twoFaToken}`,
        },
        cookies: {},
        baseUrl: "/api/v1/sites",
        path: "/",
      } as unknown as Request;

      let caughtError: any = null;
      const next = (err?: any) => {
        caughtError = err;
      };

      await authMiddleware(req, {} as Response, next);

      assert.ok(caughtError instanceof AppError);
      assert.equal(caughtError.statusCode, 401);
      assert.equal(caughtError.code, ERROR_CODE.UNAUTHORIZED);
    });

    it("should reject token with non-ACCESS purpose (e.g. PASSWORD_RESET)", async () => {
      const resetToken = jwt.sign(
        {
          sub: "user-uuid",
          email: "user@example.com",
          role: ROLES.SAFETY_MANAGER,
          purpose: "PASSWORD_RESET",
        },
        privateKey,
        { algorithm: "RS256", expiresIn: "10m" },
      );

      const req = {
        headers: {
          authorization: `Bearer ${resetToken}`,
        },
        cookies: {},
        baseUrl: "/api/v1/sites",
        path: "/",
      } as unknown as Request;

      let caughtError: any = null;
      const next = (err?: any) => {
        caughtError = err;
      };

      await authMiddleware(req, {} as Response, next);

      assert.ok(caughtError instanceof AppError);
      assert.equal(caughtError.statusCode, 401);
      assert.equal(caughtError.code, ERROR_CODE.UNAUTHORIZED);
    });

    it("should accept valid ACCESS token and populate req.user", async () => {
      const accessToken = jwt.sign(
        {
          sub: "user-uuid",
          email: "user@example.com",
          role: ROLES.SAFETY_MANAGER,
          purpose: JWT_PURPOSE.ACCESS,
          siteId: "site-uuid-1",
          siteIds: ["site-uuid-1"],
        },
        privateKey,
        { algorithm: "RS256", expiresIn: "1h" },
      );

      const req = {
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        cookies: {},
        baseUrl: "/api/v1/sites",
        path: "/",
      } as unknown as Request;

      let caughtError: any = null;
      const next = (err?: any) => {
        caughtError = err;
      };

      await authMiddleware(req, {} as Response, next);

      assert.equal(caughtError, undefined);
      assert.ok(req.user);
      assert.equal(req.user.id, "user-uuid");
      assert.equal(req.user.siteId, "site-uuid-1");
      assert.deepEqual(req.user.siteIds, ["site-uuid-1"]);
    });
  });

  // ── SEC-03: BOLA Cross-Site Boundary Scoping ──────────────────────────────
  describe("SEC-03: BOLA-CROSS-SITE-RESOURCE-ACCESS", () => {
    const siteA = {
      id: "site-A",
      name: "Site Alpha",
      code: "SITE-ALPHA",
      _count: { zones: 0, restrictedAreas: 0 },
    };
    const siteB = {
      id: "site-B",
      name: "Site Beta",
      code: "SITE-BETA",
      _count: { zones: 0, restrictedAreas: 0 },
    };

    const zoneB = {
      id: "zone-B1",
      siteId: "site-B",
      name: "Zone Beta 1",
      code: "ZB-01",
    };

    const restrictedAreaB = {
      id: "ra-B1",
      siteId: "site-B",
      zoneId: "zone-B1",
      name: "Danger Beta",
      boundary: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }],
    };

    const mockRepo = {
      findSiteById: async (id: string) => {
        if (id === "site-A") return siteA;
        if (id === "site-B") return siteB;
        return null;
      },
      updateSite: async (id: string, data: any) => ({ id, ...data }),
      deleteSite: async (id: string) => ({ id }),
      findSiteByCode: async () => null,
      findSafetyConfigBySiteId: async (siteId: string) => ({
        id: "cfg-1",
        siteId,
        confidenceThreshold: 0.8,
        confirmationDuration: 3,
        cooldownDuration: 30,
        enableNoHelmet: true,
        enableNoVest: true,
        enableRestrictedArea: true,
      }),
      upsertSafetyConfig: async (siteId: string, data: any) => ({
        id: "cfg-1",
        siteId,
        ...data,
      }),
      findZoneById: async (id: string) => {
        if (id === "zone-B1") return zoneB;
        return null;
      },
      updateZone: async (id: string, data: any) => ({ id, ...data }),
      deleteZone: async (id: string) => ({ id }),
      createZone: async (data: any) => ({ id: "zone-new", ...data }),
      findZoneByCode: async () => null,
      findRestrictedAreaById: async (id: string) => {
        if (id === "ra-B1") return restrictedAreaB;
        return null;
      },
      updateRestrictedArea: async (id: string, data: any) => ({ id, ...data }),
      deleteRestrictedArea: async (id: string) => ({ id }),
      createRestrictedArea: async (data: any) => ({ id: "ra-new", ...data }),
      findAllSites: async (query: any) => ({
        data: query.siteIds?.includes("site-A") ? [siteA] : [siteA, siteB],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    } as unknown as SiteRepository;

    const userSiteA = {
      id: "manager-A",
      email: "manager@site-a.com",
      role: ROLES.SAFETY_MANAGER,
      siteId: "site-A",
      siteIds: ["site-A"],
    };

    const adminUser = {
      id: "admin-root",
      email: "admin@global.com",
      role: ROLES.ADMIN,
      siteId: null,
      siteIds: [],
    };

    it("should reject non-admin user querying site outside assigned siteIds", async () => {
      const service = new SiteService(mockRepo);

      await assert.rejects(
        async () => {
          await service.findSiteById("site-B", userSiteA);
        },
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 403);
          assert.equal(err.code, ERROR_CODE.FORBIDDEN);
          return true;
        },
      );
    });

    it("should allow non-admin user querying assigned site", async () => {
      const service = new SiteService(mockRepo);
      const site = await service.findSiteById("site-A", userSiteA);
      assert.equal(site.id, "site-A");
    });

    it("should reject non-admin user updating site outside assigned siteIds", async () => {
      const service = new SiteService(mockRepo);

      await assert.rejects(
        async () => {
          await service.updateSite("site-B", { name: "Hacked Site" }, undefined, userSiteA);
        },
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 403);
          assert.equal(err.code, ERROR_CODE.FORBIDDEN);
          return true;
        },
      );
    });

    it("should reject non-admin user deleting site outside assigned siteIds", async () => {
      const service = new SiteService(mockRepo);

      await assert.rejects(
        async () => {
          await service.deleteSite("site-B", false, undefined, userSiteA);
        },
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 403);
          assert.equal(err.code, ERROR_CODE.FORBIDDEN);
          return true;
        },
      );
    });

    it("should reject non-admin user modifying safety config of foreign site", async () => {
      const service = new SiteService(mockRepo);

      await assert.rejects(
        async () => {
          await service.updateSafetyConfig(
            "site-B",
            { confidenceThreshold: 0.5 },
            undefined,
            userSiteA,
          );
        },
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 403);
          assert.equal(err.code, ERROR_CODE.FORBIDDEN);
          return true;
        },
      );
    });

    it("should reject non-admin user creating zone in foreign site", async () => {
      const service = new SiteService(mockRepo);

      await assert.rejects(
        async () => {
          await service.createZone(
            { siteId: "site-B", name: "Infiltrated Zone", code: "Z-INF" },
            userSiteA,
          );
        },
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 403);
          assert.equal(err.code, ERROR_CODE.FORBIDDEN);
          return true;
        },
      );
    });

    it("should reject non-admin user accessing zone belonging to foreign site", async () => {
      const service = new SiteService(mockRepo);

      await assert.rejects(
        async () => {
          await service.findZoneById("zone-B1", userSiteA);
        },
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 403);
          assert.equal(err.code, ERROR_CODE.FORBIDDEN);
          return true;
        },
      );
    });

    it("should reject non-admin user accessing restricted area belonging to foreign site", async () => {
      const service = new SiteService(mockRepo);

      await assert.rejects(
        async () => {
          await service.findRestrictedAreaById("ra-B1", userSiteA);
        },
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 403);
          assert.equal(err.code, ERROR_CODE.FORBIDDEN);
          return true;
        },
      );
    });

    it("should allow global Admin user to access any site", async () => {
      const service = new SiteService(mockRepo);
      const site = await service.findSiteById("site-B", adminUser);
      assert.equal(site.id, "site-B");
    });

    it("should automatically scope findAllSites to allowed siteIds for non-admin", async () => {
      const service = new SiteService(mockRepo);
      const result = await service.findAllSites({ page: 1, limit: 10 }, userSiteA);
      assert.equal(result.data.length, 1);
      assert.equal(result.data[0].id, "site-A");
    });
  });

  // ── SEC-05: Cross-Site Camera Effective Rule Resolution ───────────────────
  describe("SEC-05: CROSS-SITE-CAMERA-EFFECTIVE-RULE-CORRUPTION", () => {
    it("should reject effective config request when camera does not belong to specified siteId", async () => {
      const mockCameraClient = {
        findCameraById: async (id: string) => ({
          id,
          siteId: "site-B", // Camera belongs to site-B!
          name: "Camera Beta 1",
          code: "CAM-B1",
          zoneId: "zone-B1",
        }),
        findCameraConfig: async () => null,
      };

      const mockReportingClient = {
        findActiveModelVersion: async () => null,
      };

      const mockRepo = {
        findSiteById: async (id: string) => ({ id, name: "Site A", code: "SITE-A" }),
        findSiteSafetyConfig: async () => null,
        findRestrictedAreas: async () => [],
      };

      const cache = new SafetyRuleCacheService();
      const service = new SafetyRuleService(
        mockRepo as any,
        mockCameraClient as any,
        mockReportingClient as any,
        cache,
      );

      await assert.rejects(
        async () => {
          await service.getEffectiveConfig({
            siteId: "site-A",
            cameraId: "cam-B1", // Caller claims it is in Site A, but camera belongs to Site B!
          });
        },
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, ERROR_CODE.VALIDATION_ERROR);
          assert.match(err.message, /không thuộc công trường/);
          return true;
        },
      );
    });

    it("should reject cached camera config when requested with mismatched siteId", async () => {
      const mockCameraClient = {
        findCameraById: async () => null,
        findCameraConfig: async () => null,
      };

      const mockReportingClient = {
        findActiveModelVersion: async () => null,
      };

      const mockRepo = {
        findSiteById: async () => null,
        findSiteSafetyConfig: async () => null,
        findRestrictedAreas: async () => [],
      };

      const cache = new SafetyRuleCacheService();
      // Pre-populate cache for camera-1 belonging to site-B
      cache.set("effective:site:site-B:camera:cam-1", {
        siteId: "site-B",
        siteName: "Site B",
        siteCode: "SITE-B",
        cameraId: "cam-1",
        cameraName: "Cam 1",
        cameraCode: "C-01",
        confidenceThreshold: 0.8,
        confirmationDuration: 3,
        cooldownDuration: 30,
        rules: {
          enableNoHelmet: true,
          enableNoVest: true,
          enableRestrictedArea: true,
        },
        modelVersion: null,
        restrictedAreas: [],
        source: "CAMERA_OVERRIDE" as any,
        resolvedAt: new Date().toISOString(),
      });

      const service = new SafetyRuleService(
        mockRepo as any,
        mockCameraClient as any,
        mockReportingClient as any,
        cache,
      );

      await assert.rejects(
        async () => {
          await service.getEffectiveConfig({
            siteId: "site-A", // Mismatched siteId
            cameraId: "cam-1",
          });
        },
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, ERROR_CODE.VALIDATION_ERROR);
          assert.match(err.message, /không thuộc công trường/);
          return true;
        },
      );
    });

    it("should accept effective config request when camera belongs to specified siteId", async () => {
      const mockCameraClient = {
        findCameraById: async (id: string) => ({
          id,
          siteId: "site-A",
          name: "Camera Alpha 1",
          code: "CAM-A1",
          zoneId: null,
        }),
        findCameraConfig: async () => null,
      };

      const mockReportingClient = {
        findActiveModelVersion: async () => null,
      };

      const mockRepo = {
        findSiteById: async (id: string) => ({ id, name: "Site A", code: "SITE-A" }),
        findSiteSafetyConfig: async () => ({
          siteId: "site-A",
          confidenceThreshold: 0.85,
          confirmationDuration: 5,
          cooldownDuration: 20,
          enableNoHelmet: true,
          enableNoVest: false,
          enableRestrictedArea: true,
        }),
        findRestrictedAreas: async () => [],
      };

      const cache = new SafetyRuleCacheService();
      const service = new SafetyRuleService(
        mockRepo as any,
        mockCameraClient as any,
        mockReportingClient as any,
        cache,
      );

      const result = await service.getEffectiveConfig({
        siteId: "site-A",
        cameraId: "cam-A1",
      });

      assert.equal(result.siteId, "site-A");
      assert.equal(result.cameraId, "cam-A1");
      assert.equal(result.confidenceThreshold, 0.85);
    });
  });

  // ── SEC-06: Dual Safety Config Endpoints & Cache Invalidation ─────────────
  describe("SEC-06: DUAL-ENDPOINT-SCHEMA-AND-CACHE-INVALIDATION-SPLIT", () => {
    it("should invalidate site cache when SiteService.updateSafetyConfig is invoked", async () => {
      let invalidatedSiteId: string | null = null;
      const mockCache = {
        invalidateSite: (siteId: string) => {
          invalidatedSiteId = siteId;
        },
      } as any;

      const mockRepo = {
        findSiteById: async (id: string) => ({ id, name: "Site Test" }),
        upsertSafetyConfig: async (siteId: string, data: any) => ({
          id: "cfg-1",
          siteId,
          ...data,
        }),
      } as any;

      const service = new SiteService(mockRepo, undefined, mockCache);
      await service.updateSafetyConfig("site-uuid-123", {
        confidenceThreshold: 0.9,
      });

      assert.equal(invalidatedSiteId, "site-uuid-123");
    });

    it("should reject cooldownDuration exceeding 300 seconds in updateSiteSafetyConfigSchema", () => {
      const invalid = updateSiteSafetyConfigSchema.safeParse({
        cooldownDuration: 301,
      });
      assert.equal(invalid.success, false);
      if (!invalid.success) {
        assert.ok(invalid.error.errors.some((e) => e.message.includes("tối đa 300")));
      }

      const excessive = updateSiteSafetyConfigSchema.safeParse({
        cooldownDuration: 3600,
      });
      assert.equal(excessive.success, false);

      const valid = updateSiteSafetyConfigSchema.safeParse({
        cooldownDuration: 300,
      });
      assert.equal(valid.success, true);
    });
  });

  // ── SEC-07: Database Migration UUIDv7 Stored Procedure ────────────────────
  describe("SEC-07: MISSING-UUID-V7-STORED-PROCEDURE-IN-INITIAL-MIGRATION", () => {
    it("should provision pgcrypto extension and uuid_generate_v7() stored procedure in migration.sql", () => {
      const migrationPath = path.resolve(
        __dirname,
        "../prisma/migrations/20261008170815_init_site/migration.sql",
      );
      const content = fs.readFileSync(migrationPath, "utf-8");

      assert.match(content, /CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+"?pgcrypto"?/i);
      assert.match(content, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+uuid_generate_v7\(\)/i);
      assert.match(content, /RETURNS\s+uuid\s+AS/i);
    });
  });
});


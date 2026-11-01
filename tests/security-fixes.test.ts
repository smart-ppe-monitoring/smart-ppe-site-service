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
import { envSchema } from "../src/config/env.config";
import { CameraServiceClient } from "../src/clients/camera.client";
import { ReportingServiceClient } from "../src/clients/reporting.client";
import fs from "node:fs";
import path from "node:path";
import { AppError } from "../src/common/errors/app-error";
import { ERROR_CODE } from "../src/common/errors/error-code";
import { PERMISSIONS } from "../src/common/constants/permission.constant";
import { ROLES } from "../src/common/constants/role.constant";
import { JWT_PURPOSE, JWT_ALGORITHM } from "../src/common/constants/jwt.constant";
import { SITE_STATUS } from "../src/common/constants/site.constant";

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

  // ── SEC-08: Satellite Environment Schema Eliminates Private Key Requirement ──
  describe("SEC-08: PRODUCTION-JWT-PRIVATE-KEY-LEAKAGE-REQUIREMENT", () => {
    const baseProdEnv = {
      NODE_ENV: "production",
      SITE_DATABASE_URL: "postgresql://site_user:pass@localhost:5433/site_db",
      JWT_ALGORITHM: "RS256",
      JWT_ACCESS_SECRET: "a".repeat(32),
      JWT_REFRESH_SECRET: "b".repeat(32),
      ALLOWED_ORIGINS: "https://app.smart-ppe.com",
      ENCRYPTION_KEY: "c".repeat(32),
      GOOGLE_OAUTH_ALLOWED_REDIRECT_URIS: "https://app.smart-ppe.com/callback",
    };

    it("should validate production env with only JWT_PUBLIC_KEY and empty JWT_PRIVATE_KEY", () => {
      const prodEnv = {
        ...baseProdEnv,
        JWT_PUBLIC_KEY: "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A\n-----END PUBLIC KEY-----",
        JWT_PRIVATE_KEY: "", // Should NOT be required for satellite microservice
      };

      const result = envSchema.safeParse(prodEnv);
      assert.equal(result.success, true);
    });

    it("should validate production env with AUTH_JWKS_URL and empty JWT_PRIVATE_KEY", () => {
      const prodEnv = {
        ...baseProdEnv,
        AUTH_JWKS_URL: "https://identity.smart-ppe.local/.well-known/jwks.json",
        JWT_PRIVATE_KEY: "",
      };

      const result = envSchema.safeParse(prodEnv);
      assert.equal(result.success, true);
    });

    it("should reject production env if neither JWT_PUBLIC_KEY nor AUTH_JWKS_URL is configured", () => {
      const invalidProdEnv = {
        ...baseProdEnv,
        JWT_PUBLIC_KEY: "",
        AUTH_JWKS_URL: "",
      };

      const result = envSchema.safeParse(invalidProdEnv);
      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(
          result.error.errors.some((e) =>
            e.message.includes("JWT_PUBLIC_KEY hoặc AUTH_JWKS_URL bắt buộc"),
          ),
        );
      }
    });
  });

  // ── SEC-09: Inter-Service HTTP Clients M2M Bearer Authentication ──────────
  describe("SEC-09: UNAUTHENTICATED-M2M-INTER-SERVICE-CALLS", () => {
    const originalFetch = global.fetch;

    it("should attach Authorization Bearer header in CameraServiceClient when token is provided", async () => {
      let capturedHeaders: any = null;
      global.fetch = async (_url: any, init: any) => {
        capturedHeaders = init?.headers;
        return new globalThis.Response(
          JSON.stringify({ data: { id: "cam-100", siteId: "site-1" } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      };

      try {
        const client = new CameraServiceClient("http://camera-service:8892");
        const camera = await client.findCameraById("cam-100", "sample-m2m-jwt-token");

        assert.ok(camera);
        assert.equal(camera.id, "cam-100");
        assert.equal(capturedHeaders?.["Authorization"], "Bearer sample-m2m-jwt-token");
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("should attach Authorization Bearer header in ReportingServiceClient when token is provided", async () => {
      let capturedHeaders: any = null;
      global.fetch = async (_url: any, init: any) => {
        capturedHeaders = init?.headers;
        return new globalThis.Response(
          JSON.stringify({
            data: { id: "v-model-1", modelId: "m1", modelName: "YOLO11" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      };

      try {
        const client = new ReportingServiceClient("http://reporting-service:8894");
        const model = await client.findActiveModelVersion("v-model-1", "sample-reporting-jwt-token");

        assert.ok(model);
        assert.equal(model.id, "v-model-1");
        assert.equal(capturedHeaders?.["Authorization"], "Bearer sample-reporting-jwt-token");
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  // ── SEC-10: Zone Hard Deletion Protection Against Promotion ──────────────
  describe("SEC-10: ZONE-HARD-DELETE-SETS-NULL-PROMOTING-RESTRICTED-AREAS", () => {
    it("should reject deleting zone when it contains restricted areas and force=false", async () => {
      const mockRepo = {
        findZoneById: async (id: string) => ({
          id,
          siteId: "site-uuid",
          name: "Zone With Hazardous Areas",
          restrictedAreas: [
            { id: "ra-1", name: "High Voltage Area" },
            { id: "ra-2", name: "Deep Excavation Pit" },
          ],
        }),
        deleteZone: async (id: string) => ({ id }),
      } as any;

      const service = new SiteService(mockRepo);

      await assert.rejects(
        async () => {
          await service.deleteZone("zone-with-ra", false);
        },
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, ERROR_CODE.VALIDATION_ERROR);
          assert.match(err.message, /Không thể xóa phân khu đang chứa 2 vùng hạn chế/);
          return true;
        },
      );
    });

    it("should allow deleting zone with restricted areas when force=true", async () => {
      let deletedZoneId: string | null = null;
      const mockRepo = {
        findZoneById: async (id: string) => ({
          id,
          siteId: "site-uuid",
          name: "Zone With Hazardous Areas",
          restrictedAreas: [{ id: "ra-1", name: "Hazard 1" }],
        }),
        deleteZone: async (id: string) => {
          deletedZoneId = id;
          return { id };
        },
      } as any;

      const service = new SiteService(mockRepo);
      const res = await service.deleteZone("zone-with-ra", true);

      assert.equal(deletedZoneId, "zone-with-ra");
      assert.equal(res.id, "zone-with-ra");
    });

    it("should allow deleting zone when it contains no restricted areas", async () => {
      let deletedZoneId: string | null = null;
      const mockRepo = {
        findZoneById: async (id: string) => ({
          id,
          siteId: "site-uuid",
          name: "Clean Zone",
          restrictedAreas: [],
        }),
        deleteZone: async (id: string) => {
          deletedZoneId = id;
          return { id };
        },
      } as any;

      const service = new SiteService(mockRepo);
      const res = await service.deleteZone("clean-zone", false);

      assert.equal(deletedZoneId, "clean-zone");
      assert.equal(res.id, "clean-zone");
    });
  });

  // ── SEC-11: Unenforced mustChangePassword Flag in Satellite Auth ───────────
  describe("SEC-11: AUTH-UNENFORCED-MUST-CHANGE-PASSWORD", () => {
    it("should reject token with mustChangePassword=true with HTTP 403 FORBIDDEN", async () => {
      const token = jwt.sign(
        {
          sub: "user-pwd-reset",
          email: "mustchange@site.com",
          role: ROLES.OPERATOR,
          mustChangePassword: true,
          purpose: JWT_PURPOSE.ACCESS,
        },
        privateKey,
        { algorithm: "RS256", expiresIn: "1h" },
      );

      const req = {
        headers: { authorization: `Bearer ${token}` },
        query: {},
        cookies: {},
        baseUrl: "/api/v1/sites",
        path: "/",
      } as unknown as Request;

      let caughtError: any = null;
      await authMiddleware(req, {} as Response, (err) => {
        caughtError = err;
      });

      assert.ok(caughtError instanceof AppError);
      assert.equal(caughtError.statusCode, 403);
      assert.equal(caughtError.code, ERROR_CODE.FORBIDDEN);
      assert.match(caughtError.message, /đổi mật khẩu/);
    });

    it("should allow token when mustChangePassword is false or omitted", async () => {
      const token = jwt.sign(
        {
          sub: "user-normal",
          email: "normal@site.com",
          role: ROLES.OPERATOR,
          mustChangePassword: false,
          purpose: JWT_PURPOSE.ACCESS,
        },
        privateKey,
        { algorithm: "RS256", expiresIn: "1h" },
      );

      const req = {
        headers: { authorization: `Bearer ${token}` },
        query: {},
        cookies: {},
        baseUrl: "/api/v1/sites",
        path: "/",
      } as unknown as Request;

      let nextCalled = false;
      let caughtError: any = null;
      await authMiddleware(req, {} as Response, (err) => {
        nextCalled = true;
        caughtError = err;
      });

      assert.equal(nextCalled, true);
      assert.equal(caughtError, undefined);
      assert.equal((req as any).user.email, "normal@site.com");
    });
  });

  // ── SEC-12: Container Build Missing Public Key and Lockfile ────────────────
  describe("SEC-12: CONTAINER-BUILD-MISSING-PUBLIC-KEY-AND-LOCKFILE", () => {
    it("should include pnpm-lock.yaml and --frozen-lockfile in Dockerfile deps stage", () => {
      const dockerfilePath = path.resolve(__dirname, "../Dockerfile");
      const content = fs.readFileSync(dockerfilePath, "utf-8");

      assert.match(content, /COPY package\.json pnpm-lock\.yaml\*/);
      assert.match(content, /pnpm install --frozen-lockfile/);
    });

    it("should copy keys directory to runner stage in Dockerfile", () => {
      const dockerfilePath = path.resolve(__dirname, "../Dockerfile");
      const content = fs.readFileSync(dockerfilePath, "utf-8");

      assert.match(content, /COPY --from=builder \/app\/keys \.\/keys/);
    });
  });

  // ── SEC-13: Cross-Site Restricted Area Hierarchy Contamination ─────────────
  describe("SEC-13: CROSS-SITE-RESTRICTED-AREA-HIERARCHY-CONTAMINATION", () => {
    it("should reject createRestrictedArea with 400 VALIDATION_ERROR when zoneId does not exist", async () => {
      const mockRepo = {
        findSiteById: async (id: string) => ({ id, name: "Site A", status: SITE_STATUS.ACTIVE }),
        findZoneById: async (_id: string) => null,
      } as unknown as SiteRepository;

      const service = new SiteService(mockRepo);

      await assert.rejects(
        async () => {
          await service.createRestrictedArea({
            siteId: "site-uuid",
            zoneId: "non-existent-zone-uuid",
            name: "Danger Pit",
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
          assert.match(err.message, /không tồn tại hoặc không thuộc công trường này/);
          return true;
        },
      );
    });

    it("should reject createRestrictedArea with 400 VALIDATION_ERROR when zoneId belongs to foreign site", async () => {
      const mockRepo = {
        findSiteById: async (id: string) => ({ id, name: "Site A", status: SITE_STATUS.ACTIVE }),
        findZoneById: async (id: string) => ({
          id,
          siteId: "different-site-uuid",
          name: "Zone In Different Site",
        }),
      } as unknown as SiteRepository;

      const service = new SiteService(mockRepo);

      await assert.rejects(
        async () => {
          await service.createRestrictedArea({
            siteId: "my-site-uuid",
            zoneId: "zone-in-other-site",
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
          assert.match(err.message, /không tồn tại hoặc không thuộc công trường này/);
          return true;
        },
      );
    });

    it("should reject updateRestrictedArea with 400 VALIDATION_ERROR when target zone is foreign or non-existent", async () => {
      const mockRepo = {
        findRestrictedAreaById: async (id: string) => ({
          id,
          siteId: "site-uuid",
          name: "Existing Area",
        }),
        findZoneById: async (_id: string) => null,
      } as unknown as SiteRepository;

      const service = new SiteService(mockRepo);

      await assert.rejects(
        async () => {
          await service.updateRestrictedArea("ra-uuid", {
            zoneId: "non-existent-zone-uuid",
          });
        },
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, ERROR_CODE.VALIDATION_ERROR);
          assert.match(err.message, /không tồn tại hoặc không thuộc công trường của vùng hạn chế này/);
          return true;
        },
      );
    });
  });

  // ── SEC-14: Decommissioned Site Mutation State Bypass ──────────────────────
  describe("SEC-14: DECOMMISSIONED-SITE-MUTATION-STATE-BYPASS", () => {
    it("should reject createZone on ARCHIVED, COMPLETED, or INACTIVE site with 400 INVALID_STATE", async () => {
      const decommissionedStatuses = [
        SITE_STATUS.ARCHIVED,
        SITE_STATUS.COMPLETED,
        SITE_STATUS.INACTIVE,
      ];

      for (const status of decommissionedStatuses) {
        const mockRepo = {
          findSiteById: async (id: string) => ({
            id,
            name: "Closed Site",
            status,
          }),
        } as unknown as SiteRepository;

        const service = new SiteService(mockRepo);

        await assert.rejects(
          async () => {
            await service.createZone({
              siteId: "site-closed",
              name: "New Zone In Decommissioned Site",
              code: "ZONE-DEC",
            });
          },
          (err: any) => {
            assert.ok(err instanceof AppError);
            assert.equal(err.statusCode, 400);
            assert.equal(err.code, ERROR_CODE.INVALID_STATE);
            assert.match(err.message, /Không thể thao tác trên công trường đã/);
            return true;
          },
        );
      }
    });

    it("should reject createRestrictedArea on an ARCHIVED site with 400 INVALID_STATE", async () => {
      const mockRepo = {
        findSiteById: async (id: string) => ({
          id,
          name: "Archived Site",
          status: SITE_STATUS.ARCHIVED,
        }),
      } as unknown as SiteRepository;

      const service = new SiteService(mockRepo);

      await assert.rejects(
        async () => {
          await service.createRestrictedArea({
            siteId: "site-archived",
            name: "Ghost Hazard Area",
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
          assert.equal(err.code, ERROR_CODE.INVALID_STATE);
          assert.match(err.message, /Không thể thao tác trên công trường đã/);
          return true;
        },
      );
    });

    it("should reject updateSafetyConfig on a COMPLETED site with 400 INVALID_STATE", async () => {
      const mockRepo = {
        findSiteById: async (id: string) => ({
          id,
          name: "Completed Site",
          status: SITE_STATUS.COMPLETED,
        }),
      } as unknown as SiteRepository;

      const service = new SiteService(mockRepo);

      await assert.rejects(
        async () => {
          await service.updateSafetyConfig("site-completed", {
            confidenceThreshold: 0.95,
          });
        },
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, ERROR_CODE.INVALID_STATE);
          assert.match(err.message, /Không thể thao tác trên công trường đã/);
          return true;
        },
      );
    });

    it("should allow createZone on an ACTIVE site", async () => {
      let createdData: any = null;
      const mockRepo = {
        findSiteById: async (id: string) => ({
          id,
          name: "Active Site",
          status: SITE_STATUS.ACTIVE,
        }),
        findZoneByCode: async () => null,
        createZone: async (data: any) => {
          createdData = data;
          return { id: "zone-new-uuid", ...data };
        },
      } as unknown as SiteRepository;

      const service = new SiteService(mockRepo);
      const res = await service.createZone({
        siteId: "site-active",
        name: "Active Zone",
        code: "AZ-01",
      });

      assert.equal(res.id, "zone-new-uuid");
      assert.equal(createdData.code, "AZ-01");
    });
  });
});


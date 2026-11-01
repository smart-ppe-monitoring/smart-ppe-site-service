import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { Request, Response } from "express";
import { requirePermission, requireAnyPermission } from "../src/middlewares/permission.middleware";
import {
  authMiddleware,
  extractTokenFromRequest,
  setApiKeyResolver,
} from "../src/middlewares/auth.middleware";
import { createRateLimiter } from "../src/middlewares/rate-limit.middleware";
import {
  encryptSecret,
  decryptSecret,
  getMasterKeyBuffer,
} from "../src/common/helpers/crypto.helper";
import { errorMiddleware } from "../src/middlewares/error.middleware";
import { createRequireGatewayOrigin } from "../src/middlewares/request-id.middleware";
import { jwtConfig } from "../src/config/jwt.config";
import {
  SiteService,
  defaultSiteAuditLogger,
  DefaultSiteAuditLogger,
} from "../src/modules/site/site.service";
import { SiteRepository } from "../src/modules/site/site.repository";
import { SafetyRuleService } from "../src/modules/safety-rule/safety-rule.service";
import {
  SafetyRuleRepository,
  safetyRuleRepository,
  defaultSafetyAuditLogger,
  DefaultSafetyAuditLogger,
} from "../src/modules/safety-rule/safety-rule.repository";
import {
  SafetyRuleCacheService,
  SAFETY_RULE_CACHE_PUBSUB_CHANNEL,
} from "../src/modules/safety-rule/safety-rule-cache.service";
import { isUuid, generateId, UUID_REGEX } from "../src/common/helpers/uuid.helper";
import { maintenanceGuard } from "../src/middlewares/maintenance.middleware";
import {
  updateSiteSafetyConfigSchema,
  siteQuerySchema,
  zoneQuerySchema,
  restrictedAreaQuerySchema,
  polygonPointSchema,
  createRestrictedAreaSchema,
} from "../src/modules/site/site.validation";
import { invalidateCacheSchema } from "../src/modules/safety-rule/safety-rule.validation";
import { envSchema, envConfig, parseTrustProxy } from "../src/config/env.config";
import {
  calculatePaginationSkip,
  MAX_PAGE,
  MAX_PAGINATION_SKIP,
} from "../src/common/helpers/pagination.helper";
import {
  checkDatabaseHealth,
  resetDatabaseHealthCache,
  DB_HEALTH_CACHE_TTL_MS,
} from "../src/site.app";
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

  // ── SEC-15: Global Cache Purge Stampede DoS ────────────────────────────────
  describe("SEC-15: GLOBAL-CACHE-PURGE-STAMPEDE-DOS", () => {
    it("should reject empty payload in invalidateCacheSchema", () => {
      const result = invalidateCacheSchema.safeParse({});
      assert.equal(result.success, false);
      if (!result.success) {
        assert.match(
          result.error.issues[0].message,
          /Phải cung cấp ít nhất siteId hoặc cameraId để xóa cache/,
        );
      }
    });

    it("should accept payload with siteId or cameraId in invalidateCacheSchema", () => {
      const validSite = invalidateCacheSchema.safeParse({
        siteId: "018f3a2b-1234-7000-8000-000000000001",
      });
      assert.equal(validSite.success, true);

      const validCamera = invalidateCacheSchema.safeParse({
        cameraId: "018f3a2b-1234-7000-8000-000000000002",
      });
      assert.equal(validCamera.success, true);
    });

    it("SafetyRuleService.clearCache should reject when neither siteId nor cameraId is provided", () => {
      const mockCache = {
        invalidateCamera: () => {},
        invalidateSite: () => {},
        clear: () => {},
      } as any;

      const service = new SafetyRuleService({} as any, {} as any, {} as any, mockCache);

      assert.throws(
        () => {
          service.clearCache();
        },
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, ERROR_CODE.VALIDATION_ERROR);
          assert.match(err.message, /Phải cung cấp ít nhất siteId hoặc cameraId/);
          return true;
        },
      );
    });

    it("SafetyRuleService.clearCache should invalidate targeted site or camera", () => {
      let invalidatedSiteId: string | null = null;
      let invalidatedCameraId: string | null = null;

      const mockCache = {
        invalidateCamera: (id: string) => {
          invalidatedCameraId = id;
        },
        invalidateSite: (id: string) => {
          invalidatedSiteId = id;
        },
        clear: () => {},
      } as any;

      const service = new SafetyRuleService({} as any, {} as any, {} as any, mockCache);

      service.clearCache("site-123", undefined);
      assert.equal(invalidatedSiteId, "site-123");

      service.clearCache(undefined, "cam-456");
      assert.equal(invalidatedCameraId, "cam-456");
    });
  });

  // ── SEC-16: Inverted Date Range Lifecycle Mutation Bypass ──────────────────
  describe("SEC-16: INVERTED-DATE-RANGE-LIFECYCLE-MUTATION-BYPASS", () => {
    it("should reject partial update when new endDate is before existing startDate", async () => {
      const mockRepo = {
        findSiteById: async (id: string) => ({
          id,
          name: "Site Alpha",
          startDate: new Date("2026-06-01T00:00:00.000Z"),
          endDate: new Date("2026-12-31T00:00:00.000Z"),
        }),
        updateSite: async (id: string, data: any) => ({ id, ...data }),
      } as unknown as SiteRepository;

      const service = new SiteService(mockRepo);

      await assert.rejects(
        async () => {
          await service.updateSite("site-1", {
            endDate: new Date("2026-01-01T00:00:00.000Z") as any,
          });
        },
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, ERROR_CODE.VALIDATION_ERROR);
          assert.match(err.message, /Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu/);
          return true;
        },
      );
    });

    it("should reject partial update when new startDate is after existing endDate", async () => {
      const mockRepo = {
        findSiteById: async (id: string) => ({
          id,
          name: "Site Beta",
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          endDate: new Date("2026-06-01T00:00:00.000Z"),
        }),
        updateSite: async (id: string, data: any) => ({ id, ...data }),
      } as unknown as SiteRepository;

      const service = new SiteService(mockRepo);

      await assert.rejects(
        async () => {
          await service.updateSite("site-2", {
            startDate: new Date("2026-09-01T00:00:00.000Z") as any,
          });
        },
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, ERROR_CODE.VALIDATION_ERROR);
          assert.match(err.message, /Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu/);
          return true;
        },
      );
    });

    it("should allow partial date update when effective range is valid", async () => {
      let updatedData: any = null;
      const mockRepo = {
        findSiteById: async (id: string) => ({
          id,
          name: "Site Gamma",
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          endDate: new Date("2026-06-01T00:00:00.000Z"),
        }),
        updateSite: async (id: string, data: any) => {
          updatedData = data;
          return { id, ...data };
        },
      } as unknown as SiteRepository;

      const service = new SiteService(mockRepo);
      const res = await service.updateSite("site-3", {
        endDate: new Date("2026-10-01T00:00:00.000Z") as any,
      });

      assert.equal(res.id, "site-3");
      assert.ok(updatedData.endDate);
    });
  });

  // ── SEC-17: Multi-Repo Database URL Credential Leakage ─────────────────────
  describe("SEC-17: MULTI-REPO-DATABASE-URL-CREDENTIAL-LEAKAGE", () => {
    it("envConfig.database should only expose isolated Site URL and omit foreign service URLs", () => {
      assert.ok(envConfig.database.url);
      assert.equal((envConfig.database as any).cameraUrl, undefined);
      assert.equal((envConfig.database as any).incidentUrl, undefined);
      assert.equal((envConfig.database as any).notificationUrl, undefined);
      assert.equal((envConfig.database as any).reportingUrl, undefined);
      assert.equal((envConfig.database as any).siteUrl, undefined);
    });

    it("envSchema should not mandate foreign database URLs", () => {
      const parsed = envSchema.safeParse({
        SITE_DATABASE_URL: "postgresql://site:pass@localhost:5433/ppe_site_db",
      });
      assert.equal(parsed.success, true);
    });
  });

  // ── SEC-18: Prisma Client Constructor Ignores Dynamic Database URL ─────────
  describe("SEC-18: PRISMA-CLIENT-CONSTRUCTOR-IGNORES-DYNAMIC-DATABASE-URL", () => {
    it("site.client.ts source code should pass datasources with envConfig.database.url", () => {
      const clientFilePath = path.resolve(__dirname, "../src/database/site.client.ts");
      const content = fs.readFileSync(clientFilePath, "utf-8");

      assert.ok(content.includes("datasources: {"));
      assert.ok(content.includes("db: { url: envConfig.database.url }"));
    });
  });

  // ── SEC-19: Unindexed Substring Pattern Matching & Wildcard Injection ─────
  describe("SEC-19: RESTRICTED-AREA-SEARCH-INJECTION-AND-WILDCARD-DENIAL-OF-SERVICE", () => {
    it("findAllRestrictedAreas should sanitize SQL wildcard characters and omit unindexed description", async () => {
      let capturedWhere: any = null;
      const mockPrisma = {
        restrictedArea: {
          count: async (args: any) => {
            capturedWhere = args.where;
            return 1;
          },
          findMany: async (args: any) => {
            capturedWhere = args.where;
            return [{ id: "ra-1", name: "Safe Pit" }];
          },
        },
      } as any;

      const repo = new SiteRepository(mockPrisma);
      await repo.findAllRestrictedAreas({ search: "danger%_pit" });

      assert.ok(capturedWhere);
      assert.ok(Array.isArray(capturedWhere.OR));
      assert.equal(capturedWhere.OR.length, 1);
      assert.deepEqual(capturedWhere.OR[0], {
        name: { contains: "danger\\%\\_pit", mode: "insensitive" },
      });
    });

    it("findAllZones should sanitize SQL wildcard characters in search query", async () => {
      let capturedWhere: any = null;
      const mockPrisma = {
        zone: {
          count: async (args: any) => {
            capturedWhere = args.where;
            return 1;
          },
          findMany: async (args: any) => {
            capturedWhere = args.where;
            return [{ id: "z-1", name: "Zone 1" }];
          },
        },
      } as any;

      const repo = new SiteRepository(mockPrisma);
      await repo.findAllZones({ search: "zone%_code" });

      assert.ok(capturedWhere);
      assert.deepEqual(capturedWhere.OR, [
        { name: { contains: "zone\\%\\_code", mode: "insensitive" } },
        { code: { contains: "zone\\%\\_code", mode: "insensitive" } },
      ]);
    });

    it("findAllSites should sanitize SQL wildcard characters in search query", async () => {
      let capturedWhere: any = null;
      const mockPrisma = {
        site: {
          count: async (args: any) => {
            capturedWhere = args.where;
            return 1;
          },
          findMany: async (args: any) => {
            capturedWhere = args.where;
            return [{ id: "s-1", name: "Site 1" }];
          },
        },
      } as any;

      const repo = new SiteRepository(mockPrisma);
      await repo.findAllSites({ search: "site%_search" });

      assert.ok(capturedWhere);
      assert.deepEqual(capturedWhere.OR, [
        { name: { contains: "site\\%\\_search", mode: "insensitive" } },
        { code: { contains: "site\\%\\_search", mode: "insensitive" } },
        { address: { contains: "site\\%\\_search", mode: "insensitive" } },
      ]);
    });
  });

  // ── SEC-20: Site Hard Delete Cascades Orphans Incidents ────────────────────
  describe("SEC-20: SITE-HARD-DELETE-CASCADES-ORPHANS-INCIDENTS", () => {
    it("deleteSite without force should archive (soft delete) clean site instead of physical delete", async () => {
      let archivedCalled = false;
      let physicalDeleteCalled = false;

      const mockRepo = {
        findSiteById: async (id: string) => ({
          id,
          name: "Clean Site",
          code: "CS-01",
          _count: { zones: 0, restrictedAreas: 0 },
        }),
        archiveSite: async (id: string) => {
          archivedCalled = true;
          return { id, status: SITE_STATUS.ARCHIVED };
        },
        deleteSite: async () => {
          physicalDeleteCalled = true;
          return {};
        },
      } as unknown as SiteRepository;

      const service = new SiteService(mockRepo);
      const res = await service.deleteSite("site-clean", false);

      assert.equal(archivedCalled, true);
      assert.equal(physicalDeleteCalled, false);
      assert.equal(res.status, SITE_STATUS.ARCHIVED);
    });

    it("deleteSite with force=true should execute physical database deletion", async () => {
      let physicalDeleteCalled = false;

      const mockRepo = {
        findSiteById: async (id: string) => ({
          id,
          name: "Site To Wipe",
          code: "SW-01",
          _count: { zones: 0, restrictedAreas: 0 },
        }),
        deleteSite: async (id: string) => {
          physicalDeleteCalled = true;
          return { id };
        },
      } as unknown as SiteRepository;

      const service = new SiteService(mockRepo);
      const res = await service.deleteSite("site-wipe", true);

      assert.equal(physicalDeleteCalled, true);
      assert.equal(res.id, "site-wipe");
    });

    it("deleteSite should reject site containing active child entities when force=false", async () => {
      const mockRepo = {
        findSiteById: async (id: string) => ({
          id,
          name: "Parent Site",
          code: "PS-01",
          _count: { zones: 3, restrictedAreas: 2 },
        }),
      } as unknown as SiteRepository;

      const service = new SiteService(mockRepo);

      await assert.rejects(
        async () => {
          await service.deleteSite("site-parent", false);
        },
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, ERROR_CODE.VALIDATION_ERROR);
          assert.match(err.message, /Không thể xóa công trường đang chứa 3 phân khu/);
          return true;
        },
      );
    });

    it("archiveSite should archive site and record audit log", async () => {
      let archivedId: string | null = null;
      let auditLogged = false;

      const mockRepo = {
        findSiteById: async (id: string) => ({
          id,
          name: "Site Alpha",
          code: "SA-01",
        }),
        archiveSite: async (id: string) => {
          archivedId = id;
          return { id, status: SITE_STATUS.ARCHIVED };
        },
      } as unknown as SiteRepository;

      const mockAudit = {
        recordLog: async () => {
          auditLogged = true;
        },
      };

      const service = new SiteService(mockRepo, mockAudit as any);
      const res = await service.archiveSite("site-alpha");

      assert.equal(archivedId, "site-alpha");
      assert.equal(auditLogged, true);
      assert.equal(res.status, SITE_STATUS.ARCHIVED);
    });
  });

  // ── SEC-21: Unhandled HTTP Headers Sent Exception in Error Middleware ─────
  describe("SEC-21: UNHANDLED-HTTP-HEADERS-SENT-EXCEPTION-IN-ERROR-MIDDLEWARE", () => {
    it("errorMiddleware should delegate to next(error) immediately when res.headersSent is true", () => {
      let nextCalledWith: any = null;
      let statusCalled = false;

      const mockRes = {
        headersSent: true,
        status: () => {
          statusCalled = true;
          return mockRes;
        },
        json: () => mockRes,
      } as unknown as Response;

      const testError = new Error("Connection abort mid-stream");
      errorMiddleware(
        testError,
        {} as Request,
        mockRes,
        (err) => {
          nextCalledWith = err;
        },
      );

      assert.equal(nextCalledWith, testError);
      assert.equal(statusCalled, false);
    });

    it("errorMiddleware should format and send response when res.headersSent is false", () => {
      let statusSet: number | null = null;
      let jsonBody: any = null;

      const mockRes = {
        headersSent: false,
        status: (code: number) => {
          statusSet = code;
          return mockRes;
        },
        json: (body: any) => {
          jsonBody = body;
          return mockRes;
        },
      } as unknown as Response;

      const appError = new AppError("Resource not found", 404, ERROR_CODE.NOT_FOUND);
      errorMiddleware(
        appError,
        {} as Request,
        mockRes,
        () => {},
      );

      assert.equal(statusSet, 404);
      assert.equal(jsonBody.code, ERROR_CODE.NOT_FOUND);
      assert.equal(jsonBody.success, false);
    });
  });

  // ── SEC-22: Unmounted API Gateway Origin Guard ────────────────────────────
  describe("SEC-22: UNMOUNTED-API-GATEWAY-ORIGIN-GUARD", () => {
    it("site.app.ts source should register requireGatewayOrigin on all business pipelines", () => {
      const appFilePath = path.resolve(__dirname, "../src/site.app.ts");
      const content = fs.readFileSync(appFilePath, "utf-8");

      assert.match(content, /import\s*\{[^}]*requireGatewayOrigin[^}]*\}\s*from\s*"\.\/middlewares\/request-id\.middleware"/);
      assert.match(content, /siteApp\.use\(\s*"\/api\/v1\/sites",\s*requireGatewayOrigin/);
      assert.match(content, /siteApp\.use\(\s*"\/api\/v1\/zones",\s*requireGatewayOrigin/);
      assert.match(content, /siteApp\.use\(\s*"\/api\/v1\/restricted-areas",\s*requireGatewayOrigin/);
      assert.match(content, /siteApp\.use\(\s*"\/api\/v1\/safety-rules",\s*requireGatewayOrigin/);
    });

    it("requireGatewayOrigin should reject direct calls lacking x-gateway-secret when secret is configured", () => {
      const gatewayGuard = createRequireGatewayOrigin("expected-traefik-secret");

      let caughtError: any = null;
      const req = {
        headers: {},
      } as unknown as Request;

      gatewayGuard(req, {} as Response, (err) => {
        caughtError = err;
      });

      assert.ok(caughtError instanceof AppError);
      assert.equal(caughtError.statusCode, 403);
      assert.equal(caughtError.code, ERROR_CODE.GATEWAY_REQUIRED);
    });

    it("requireGatewayOrigin should allow calls with valid x-gateway-secret", () => {
      const gatewayGuard = createRequireGatewayOrigin("expected-traefik-secret");

      let nextCalled = false;
      let caughtError: any = null;
      const req = {
        headers: {
          "x-gateway-secret": "expected-traefik-secret",
        },
      } as unknown as Request;

      gatewayGuard(req, {} as Response, (err) => {
        nextCalled = true;
        caughtError = err;
      });

      assert.equal(nextCalled, true);
      assert.equal(caughtError, undefined);
    });
  });

  // ── SEC-23: Auth Query Token Leak Endpoint Validation ──────────────────────
  describe("SEC-23: AUTH-QUERY-TOKEN-LEAK-ENDPOINT-VALIDATION", () => {
    it("should reject request with ?token=... query parameter with 400 VALIDATION_ERROR", async () => {
      let caughtError: any = null;
      const req = {
        query: { token: "leaked-token-in-query" },
        headers: {},
        cookies: {},
      } as unknown as Request;

      await authMiddleware(req, {} as Response, (err) => {
        caughtError = err;
      });

      assert.ok(caughtError instanceof AppError);
      assert.equal(caughtError.statusCode, 400);
      assert.equal(caughtError.code, ERROR_CODE.VALIDATION_ERROR);
      assert.match(caughtError.message, /Không được phép truyền token xác thực qua query string/);
    });

    it("should reject request with ?ticket=... query parameter with 400 VALIDATION_ERROR", async () => {
      let caughtError: any = null;
      const req = {
        query: { ticket: "leaked-ticket-in-query" },
        headers: {},
        cookies: {},
      } as unknown as Request;

      await authMiddleware(req, {} as Response, (err) => {
        caughtError = err;
      });

      assert.ok(caughtError instanceof AppError);
      assert.equal(caughtError.statusCode, 400);
      assert.equal(caughtError.code, ERROR_CODE.VALIDATION_ERROR);
      assert.match(caughtError.message, /Không được phép truyền token xác thực qua query string/);
    });

    it("extractTokenFromRequest should ignore query params and only extract from authorization or cookie", () => {
      const fromQuery = extractTokenFromRequest({
        query: { token: "token1", ticket: "ticket1" },
        headers: {},
        cookies: {},
      } as any);
      assert.equal(fromQuery, undefined);

      const fromBearer = extractTokenFromRequest({
        headers: { authorization: "Bearer my-jwt-token" },
        query: {},
        cookies: {},
      } as any);
      assert.equal(fromBearer, "my-jwt-token");

      const fromCookie = extractTokenFromRequest({
        cookies: { accessToken: "cookie-jwt" },
        headers: {},
        query: {},
      } as any);
      assert.equal(fromCookie, "cookie-jwt");
    });
  });

  // ── SEC-24: Concurrent Site & Zone Creation Unique Race 500 ────────────────
  describe("SEC-24: CONCURRENT-SITE-CREATION-UNIQUE-RACE-500", () => {
    it("createSite should catch Prisma P2002 error and throw AppError with 409 DUPLICATE_ENTRY", async () => {
      const mockPrisma = {
        $transaction: async () => {
          const err: any = new Error("Unique constraint failed on the fields: (`code`)");
          err.code = "P2002";
          err.name = "PrismaClientKnownRequestError";
          throw err;
        },
      } as any;

      const repo = new SiteRepository(mockPrisma);

      await assert.rejects(
        async () => {
          await repo.createSite({
            name: "Site Race",
            code: "SITE-RACE",
          });
        },
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 409);
          assert.equal(err.code, ERROR_CODE.DUPLICATE_ENTRY);
          assert.match(err.message, /đã tồn tại trong hệ thống/);
          return true;
        },
      );
    });

    it("createZone should catch Prisma P2002 error and throw AppError with 409 DUPLICATE_ENTRY", async () => {
      const mockPrisma = {
        zone: {
          create: async () => {
            const err: any = new Error("Unique constraint failed on the fields: (`siteId`,`code`)");
            err.code = "P2002";
            throw err;
          },
        },
      } as any;

      const repo = new SiteRepository(mockPrisma);

      await assert.rejects(
        async () => {
          await repo.createZone({
            siteId: "s-1",
            name: "Zone Race",
            code: "ZR-01",
          });
        },
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 409);
          assert.equal(err.code, ERROR_CODE.DUPLICATE_ENTRY);
          assert.match(err.message, /đã tồn tại trong công trường này/);
          return true;
        },
      );
    });

    it("updateSite should catch Prisma P2002 error and throw AppError with 409 DUPLICATE_ENTRY", async () => {
      const mockPrisma = {
        site: {
          update: async () => {
            const err: any = new Error("Unique constraint failed");
            err.code = "P2002";
            throw err;
          },
        },
      } as any;

      const repo = new SiteRepository(mockPrisma);

      await assert.rejects(
        async () => {
          await repo.updateSite("s-1", { code: "TAKEN-CODE" });
        },
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 409);
          assert.equal(err.code, ERROR_CODE.DUPLICATE_ENTRY);
          return true;
        },
      );
    });

    it("updateZone should catch Prisma P2002 error and throw AppError with 409 DUPLICATE_ENTRY", async () => {
      const mockPrisma = {
        zone: {
          update: async () => {
            const err: any = new Error("Unique constraint failed");
            err.code = "P2002";
            throw err;
          },
        },
      } as any;

      const repo = new SiteRepository(mockPrisma);

      await assert.rejects(
        async () => {
          await repo.updateZone("z-1", { code: "TAKEN-ZONE" });
        },
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 409);
          assert.equal(err.code, ERROR_CODE.DUPLICATE_ENTRY);
          return true;
        },
      );
    });
  });

  // ── SEC-25: Dead API Key Authentication Handler ───────────────────────────
  describe("SEC-25: DEAD-API-KEY-AUTHENTICATION-HANDLER-SILENT-FAIL", () => {
    it("authMiddleware should authenticate request with x-api-key header and populate req.apiKey and req.user", async () => {
      setApiKeyResolver((key) => {
        if (key === "ak_live_integration_test_secret") {
          return {
            user: {
              id: "m2m-service-user",
              email: "m2m@example.com",
              role: ROLES.OPERATOR,
              permissions: [PERMISSIONS.PPE_SITE_READ, PERMISSIONS.PPE_SITE_MANAGE],
            },
            apiKey: {
              id: "key-123",
              name: "Site Worker M2M Key",
              prefix: "ak_live_",
              permissions: [PERMISSIONS.PPE_SITE_READ], // Scoped down
            },
          };
        }
        return null;
      });

      const req = {
        headers: { "x-api-key": "ak_live_integration_test_secret" },
        query: {},
        cookies: {},
      } as unknown as Request;

      let nextCalled = false;
      let caughtError: any = null;
      await authMiddleware(req, {} as Response, (err) => {
        nextCalled = true;
        caughtError = err;
      });

      assert.equal(nextCalled, true);
      assert.equal(caughtError, undefined);
      assert.equal((req as any).user.id, "m2m-service-user");
      assert.equal((req as any).apiKey.id, "key-123");
      assert.deepEqual((req as any).apiKey.permissions, [PERMISSIONS.PPE_SITE_READ]);

      setApiKeyResolver(null);
    });

    it("authMiddleware should reject request when x-api-key is invalid with 401 UNAUTHORIZED", async () => {
      setApiKeyResolver(() => null);

      const req = {
        headers: { "x-api-key": "invalid-random-key" },
        query: {},
        cookies: {},
      } as unknown as Request;

      let caughtError: any = null;
      await authMiddleware(req, {} as Response, (err) => {
        caughtError = err;
      });

      assert.ok(caughtError instanceof AppError);
      assert.equal(caughtError.statusCode, 401);
      assert.equal(caughtError.code, ERROR_CODE.UNAUTHORIZED);
      assert.match(caughtError.message, /API Key không hợp lệ hoặc đã hết hạn/);

      setApiKeyResolver(null);
    });

    it("authMiddleware should authenticate request with RS256 JWT in x-api-key header", async () => {
      setApiKeyResolver(null);

      const jwtApiKey = jwt.sign(
        {
          sub: "m2m-jwt-sub",
          email: "jwt-m2m@example.com",
          role: ROLES.OPERATOR,
          apiKeyId: "jwt-key-id-456",
          apiKeyName: "JWT M2M Key",
          apiKeyPermissions: [PERMISSIONS.PPE_SITE_READ],
          purpose: JWT_PURPOSE.ACCESS,
        },
        privateKey,
        { algorithm: "RS256", expiresIn: "1h" },
      );

      const req = {
        headers: { "x-api-key": jwtApiKey },
        query: {},
        cookies: {},
      } as unknown as Request;

      let nextCalled = false;
      let caughtError: any = null;
      await authMiddleware(req, {} as Response, (err) => {
        nextCalled = true;
        caughtError = err;
      });

      assert.equal(nextCalled, true);
      assert.equal(caughtError, undefined);
      assert.equal((req as any).user.id, "m2m-jwt-sub");
      assert.equal((req as any).apiKey.id, "jwt-key-id-456");
      assert.deepEqual((req as any).apiKey.permissions, [PERMISSIONS.PPE_SITE_READ]);
    });
  });

  // ── SEC-26: Dual Express Route Mounting Rate Limiter Canonicalization ──────
  describe("SEC-26: DUAL-MOUNT-RATE-LIMIT-QUOTA-PARTITIONING", () => {
    function createMockResponse() {
      const headers: Record<string, any> = {};
      let statusCode = 200;
      let body: any = null;
      return {
        headers,
        get statusCode() {
          return statusCode;
        },
        set statusCode(val: number) {
          statusCode = val;
        },
        get body() {
          return body;
        },
        setHeader(name: string, val: any) {
          headers[name.toLowerCase()] = val;
        },
        status(code: number) {
          statusCode = code;
          return this;
        },
        json(val: any) {
          body = val;
          return this;
        },
      };
    }

    it("should share rate limit counter across dual mounts (/api/v1/sites and /sites)", () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 2,
      });

      const clientIp = "192.168.10.50";

      // 1st request to /api/v1/sites
      const req1 = { ip: clientIp, baseUrl: "/api/v1/sites", path: "/" } as unknown as Request;
      const res1 = createMockResponse();
      let next1 = false;
      limiter(req1, res1 as unknown as Response, () => {
        next1 = true;
      });

      assert.equal(next1, true);
      assert.equal(res1.headers["x-ratelimit-remaining"], 1);

      // 2nd request to /sites (alternative mount point)
      const req2 = { ip: clientIp, baseUrl: "/sites", path: "/" } as unknown as Request;
      const res2 = createMockResponse();
      let next2 = false;
      limiter(req2, res2 as unknown as Response, () => {
        next2 = true;
      });

      assert.equal(next2, true);
      assert.equal(res2.headers["x-ratelimit-remaining"], 0);

      // 3rd request to /api/v1/sites must be throttled (429)
      const req3 = { ip: clientIp, baseUrl: "/api/v1/sites", path: "/" } as unknown as Request;
      const res3 = createMockResponse();
      let next3 = false;
      limiter(req3, res3 as unknown as Response, () => {
        next3 = true;
      });

      assert.equal(next3, false);
      assert.equal(res3.statusCode, 429);
      assert.equal(res3.body.code, ERROR_CODE.RATE_LIMIT_EXCEEDED);

      // 4th request to /sites must ALSO be throttled (429)
      const req4 = { ip: clientIp, baseUrl: "/sites", path: "/" } as unknown as Request;
      const res4 = createMockResponse();
      let next4 = false;
      limiter(req4, res4 as unknown as Response, () => {
        next4 = true;
      });

      assert.equal(next4, false);
      assert.equal(res4.statusCode, 429);
      assert.equal(res4.body.code, ERROR_CODE.RATE_LIMIT_EXCEEDED);
    });

    it("should canonicalize trailing slashes and version prefixes across routes", () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
      });

      const clientIp = "192.168.10.51";

      const req1 = { ip: clientIp, baseUrl: "/api/v1/zones/", path: "/" } as unknown as Request;
      const res1 = createMockResponse();
      let next1 = false;
      limiter(req1, res1 as unknown as Response, () => {
        next1 = true;
      });
      assert.equal(next1, true);

      const req2 = { ip: clientIp, baseUrl: "/zones", path: "/" } as unknown as Request;
      const res2 = createMockResponse();
      let next2 = false;
      limiter(req2, res2 as unknown as Response, () => {
        next2 = true;
      });
      assert.equal(next2, false);
      assert.equal(res2.statusCode, 429);
    });

    it("should honor custom keyGenerator if explicitly configured", () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyGenerator: (req) => `custom-bucket:${(req.headers as any)["x-custom-tenant"]}`,
      });

      const req1 = {
        headers: { "x-custom-tenant": "tenant-abc" },
        ip: "1.1.1.1",
        baseUrl: "/api/v1/sites",
      } as unknown as Request;
      const res1 = createMockResponse();
      let next1 = false;
      limiter(req1, res1 as unknown as Response, () => {
        next1 = true;
      });
      assert.equal(next1, true);

      const req2 = {
        headers: { "x-custom-tenant": "tenant-abc" },
        ip: "2.2.2.2", // Different IP, but same tenant
        baseUrl: "/sites",
      } as unknown as Request;
      const res2 = createMockResponse();
      let next2 = false;
      limiter(req2, res2 as unknown as Response, () => {
        next2 = true;
      });
      assert.equal(next2, false);
      assert.equal(res2.statusCode, 429);
    });
  });

  // ── SEC-27: Cryptographic Helper Master Key Configuration ──────────────────
  describe("SEC-27: HARDCODED-ENCRYPTION-MASTER-KEY-FALLBACK", () => {
    it("should encrypt and decrypt secret using envConfig.encryptionKey", () => {
      const plainText = "db-credential-super-secret-password-xyz-123";
      const encrypted = encryptSecret(plainText);
      assert.notEqual(encrypted, plainText);
      assert.match(encrypted, /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);

      const decrypted = decryptSecret(encrypted);
      assert.equal(decrypted, plainText);
    });

    it("should encrypt and decrypt secret using custom key", () => {
      const plainText = "third-party-api-token-98765";
      const customKey = "my-custom-test-encryption-key-32bytes!";
      const encrypted = encryptSecret(plainText, customKey);
      assert.notEqual(encrypted, plainText);

      const decrypted = decryptSecret(encrypted, customKey);
      assert.equal(decrypted, plainText);
    });

    it("should fail decryption when wrong key is provided", () => {
      const plainText = "confidential-site-data";
      const encrypted = encryptSecret(plainText, "key-version-alpha-32-chars-long!");

      assert.throws(() => {
        decryptSecret(encrypted, "key-version-beta--32-chars-long!");
      });
    });

    it("getMasterKeyBuffer should throw if no encryption key is configured", () => {
      const originalKey = envConfig.encryptionKey;
      const originalEncKey = (envConfig.encryption as any).key;
      try {
        (envConfig as any).encryptionKey = "";
        (envConfig.encryption as any).key = "";
        assert.throws(() => {
          getMasterKeyBuffer();
        }, /Encryption key is not configured/);
      } finally {
        (envConfig as any).encryptionKey = originalKey;
        (envConfig.encryption as any).key = originalEncKey;
      }
    });

    it("should ensure crypto.helper.ts does not contain hardcoded default master key fallback or process.env.ENCRYPTION_KEY", () => {
      const cryptoHelperPath = path.resolve(__dirname, "../src/common/helpers/crypto.helper.ts");
      const content = fs.readFileSync(cryptoHelperPath, "utf8");

      assert.equal(content.includes("default-smart-ppe-master-encryption-key-32b"), false);
      assert.equal(content.includes("process.env.ENCRYPTION_KEY"), false);
      assert.ok(content.includes("envConfig.encryptionKey"));
    });
  });

  // ── SEC-28: Process-Local In-Memory Safety Cache Drift in Cluster ──────────
  describe("SEC-28: IN-MEMORY-SAFETY-CACHE-DRIFT-IN-CLUSTER", () => {
    it("should broadcast cache invalidation via Redis Pub/Sub channel and evict matching keys on remote instances", () => {
      const instanceA = new SafetyRuleCacheService();
      const instanceB = new SafetyRuleCacheService();

      const publishedMessages: { channel: string; message: string }[] = [];
      const mockPublisher = {
        publish: async (channel: string, message: string) => {
          publishedMessages.push({ channel, message });
          // Deliver to instance B
          instanceB.handleRemoteInvalidation(message);
        },
      };

      instanceA.setPublisherClient(mockPublisher);

      const dummyConfig = {
        siteId: "site-tenant-1",
        siteName: "Site 1",
        siteCode: "S1",
        effectiveConfig: {
          confidenceThreshold: 0.85,
          confirmationDuration: 2,
          cooldownDuration: 30,
          enableNoHelmet: true,
          enableNoVest: true,
          enableRestrictedArea: true,
          modelVersionId: null,
          source: "SITE_LEVEL" as any,
        },
        restrictedAreas: [],
      };

      // Both instances cache the site config
      instanceA.set("effective:site:site-tenant-1", dummyConfig);
      instanceB.set("effective:site:site-tenant-1", dummyConfig);

      assert.ok(instanceA.get("effective:site:site-tenant-1"));
      assert.ok(instanceB.get("effective:site:site-tenant-1"));

      // Instance A invalidates site-tenant-1
      instanceA.invalidateSite("site-tenant-1");

      // Verify Instance A evicted locally
      assert.equal(instanceA.get("effective:site:site-tenant-1"), null);

      // Verify Pub/Sub published message to correct channel
      assert.equal(publishedMessages.length, 1);
      assert.equal(publishedMessages[0].channel, SAFETY_RULE_CACHE_PUBSUB_CHANNEL);
      const payload = JSON.parse(publishedMessages[0].message);
      assert.equal(payload.type, "SITE");
      assert.equal(payload.id, "site-tenant-1");

      // Verify Instance B evicted its stale cache via remote invalidation
      assert.equal(instanceB.get("effective:site:site-tenant-1"), null);
    });

    it("should handle remote camera invalidation and ignore self-broadcast loop", () => {
      const instance = new SafetyRuleCacheService();
      const instanceId = instance.getInstanceId();

      const dummyConfig = {
        siteId: "site-tenant-2",
        siteName: "Site 2",
        siteCode: "S2",
        effectiveConfig: {
          confidenceThreshold: 0.8,
          confirmationDuration: 2,
          cooldownDuration: 30,
          enableNoHelmet: true,
          enableNoVest: true,
          enableRestrictedArea: true,
          modelVersionId: null,
          source: "SITE_LEVEL" as any,
        },
        restrictedAreas: [],
      };

      instance.set("effective:site:site-tenant-2:camera:cam-99", dummyConfig);
      assert.ok(instance.get("effective:site:site-tenant-2:camera:cam-99"));

      // 1. Remote message from self should be ignored
      instance.handleRemoteInvalidation(
        JSON.stringify({
          type: "CAMERA",
          id: "cam-99",
          senderId: instanceId, // Self message
        }),
      );
      assert.ok(instance.get("effective:site:site-tenant-2:camera:cam-99"));

      // 2. Remote message from another instance should evict
      instance.handleRemoteInvalidation(
        JSON.stringify({
          type: "CAMERA",
          id: "cam-99",
          senderId: "remote-instance-xyz",
        }),
      );
      assert.equal(instance.get("effective:site:site-tenant-2:camera:cam-99"), null);
    });

    it("should handle remote CLEAR message across cluster", () => {
      const instance = new SafetyRuleCacheService();
      const dummyConfig = {
        siteId: "site-3",
        siteName: "Site 3",
        siteCode: "S3",
        effectiveConfig: {} as any,
        restrictedAreas: [],
      };

      instance.set("key1", dummyConfig);
      instance.set("key2", dummyConfig);
      assert.equal(instance.size(), 2);

      instance.handleRemoteInvalidation(
        JSON.stringify({
          type: "CLEAR",
          senderId: "another-pod",
        }),
      );
      assert.equal(instance.size(), 0);
    });
  });

  // ── SEC-29: Loose UUID Regex Validation PostgreSQL Crash ────────────────────
  describe("SEC-29: LOOSE-UUID-REGEX-VALIDATION-POSTGRES-CRASH", () => {
    it("should reject non-RFC hyphenated strings that would crash PostgreSQL 22P02", () => {
      // 36 hyphens (passed with /^[0-9a-fA-F-]{36}$/)
      assert.equal(isUuid("------------------------------------"), false);

      // Misplaced hyphens
      assert.equal(isUuid("12345678-1234-1234-12345-6789012345"), false);
      assert.equal(isUuid("123456781234-1234-1234-123456789012"), false);

      // Invalid characters
      assert.equal(isUuid("g2345678-1234-1234-1234-123456789012"), false);
      assert.equal(isUuid("12345678-1234-1234-1234-12345678901z"), false);

      // Non-string or incorrect length
      assert.equal(isUuid(null), false);
      assert.equal(isUuid(undefined), false);
      assert.equal(isUuid(""), false);
      assert.equal(isUuid("1234"), false);
    });

    it("should accept valid RFC 4122 and RFC 9562 UUID strings (v4 and v7)", () => {
      const v4 = crypto.randomUUID();
      const v7 = generateId();

      assert.equal(isUuid(v4), true);
      assert.equal(isUuid(v7), true);
      assert.equal(isUuid("018d3e60-8433-7000-8000-000000000000"), true);
      assert.equal(isUuid("a1b2c3d4-e5f6-7890-abcd-ef1234567890"), true);
    });

    it("UUID_REGEX pattern must enforce strict 8-4-4-4-12 group format", () => {
      assert.equal(
        UUID_REGEX.source,
        "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
      );
    });
  });

  // ── SEC-30: No-op Maintenance Guard Governance Bypass ───────────────────────
  describe("SEC-30: MAINTENANCE-GUARD-NOOP-GOVERNANCE-BYPASS", () => {
    it("should allow requests when maintenance mode is inactive", async () => {
      const guard = maintenanceGuard({ isMaintenanceMode: false });
      const req = {
        url: "/api/v1/sites",
        user: { role: ROLES.OPERATOR },
      } as unknown as Request;

      let nextCalled = false;
      let errorThrown: any = null;
      await guard(req, {} as Response, (err) => {
        nextCalled = true;
        errorThrown = err;
      });

      assert.equal(nextCalled, true);
      assert.equal(errorThrown, undefined);
    });

    it("should block non-admin requests with 503 SERVICE_UNAVAILABLE when maintenance mode is active", async () => {
      const guard = maintenanceGuard({ isMaintenanceMode: true });
      const req = {
        url: "/api/v1/sites",
        user: { role: ROLES.OPERATOR },
      } as unknown as Request;

      let errorThrown: any = null;
      await guard(req, {} as Response, (err) => {
        errorThrown = err;
      });

      assert.ok(errorThrown instanceof AppError);
      assert.equal(errorThrown.statusCode, 503);
      assert.equal(errorThrown.code, ERROR_CODE.SERVICE_UNAVAILABLE);
      assert.match(errorThrown.message, /bảo trì/);
    });

    it("should allow ADMIN users to bypass active maintenance mode", async () => {
      const guard = maintenanceGuard({ isMaintenanceMode: true });
      const req = {
        url: "/api/v1/sites",
        user: { role: ROLES.ADMIN },
      } as unknown as Request;

      let nextCalled = false;
      let errorThrown: any = null;
      await guard(req, {} as Response, (err) => {
        nextCalled = true;
        errorThrown = err;
      });

      assert.equal(nextCalled, true);
      assert.equal(errorThrown, undefined);
    });

    it("should allow users with MAINTENANCE_BYPASS permission to bypass maintenance", async () => {
      const guard = maintenanceGuard({ isMaintenanceMode: true });
      const req = {
        url: "/api/v1/sites",
        user: { role: ROLES.OPERATOR, permissions: ["MAINTENANCE_BYPASS"] },
      } as unknown as Request;

      let nextCalled = false;
      let errorThrown: any = null;
      await guard(req, {} as Response, (err) => {
        nextCalled = true;
        errorThrown = err;
      });

      assert.equal(nextCalled, true);
      assert.equal(errorThrown, undefined);
    });

    it("should allow exempt health check and openapi paths during maintenance", async () => {
      const guard = maintenanceGuard({ isMaintenanceMode: true });

      const exemptPaths = ["/health", "/health/live", "/api/v1/sites/health", "/openapi.json"];

      for (const exemptPath of exemptPaths) {
        const req = {
          url: exemptPath,
          user: { role: ROLES.OPERATOR },
        } as unknown as Request;

        let nextCalled = false;
        let errorThrown: any = null;
        await guard(req, {} as Response, (err) => {
          nextCalled = true;
          errorThrown = err;
        });

        assert.equal(nextCalled, true, `Expected ${exemptPath} to be exempt`);
        assert.equal(errorThrown, undefined);
      }
    });

    it("should respect process.env.MAINTENANCE_MODE when no options are provided", async () => {
      const originalEnv = process.env.MAINTENANCE_MODE;
      try {
        process.env.MAINTENANCE_MODE = "true";
        const guard = maintenanceGuard();
        const req = {
          url: "/api/v1/sites",
          user: { role: ROLES.OPERATOR },
        } as unknown as Request;

        let errorThrown: any = null;
        await guard(req, {} as Response, (err) => {
          errorThrown = err;
        });

        assert.ok(errorThrown instanceof AppError);
        assert.equal(errorThrown.statusCode, 503);
      } finally {
        process.env.MAINTENANCE_MODE = originalEnv;
      }
    });
  });

  // ── SEC-31: Missing Unhandled Rejection Graceful Shutdown Handlers ──────────
  describe("SEC-31: MISSING-UNHANDLED-REJECTION-GRACEFUL-SHUTDOWN-HANDLERS", () => {
    it("src/server.ts must register unhandledRejection and uncaughtException handlers", () => {
      const serverPath = path.resolve(__dirname, "../src/server.ts");
      const content = fs.readFileSync(serverPath, "utf8");

      assert.ok(
        content.includes('process.on("unhandledRejection"'),
        "server.ts must register unhandledRejection handler",
      );
      assert.ok(
        content.includes('process.on("uncaughtException"'),
        "server.ts must register uncaughtException handler",
      );
      assert.ok(content.includes("handleSiteShutdown"));
    });
  });

  // ── SEC-32: Dead / Unconnected Audit Logging Mechanism ──────────────────────
  describe("SEC-32: NOOP-SITE-AUDIT-LOGGER", () => {
    it("DefaultSiteAuditLogger should record structured audit log entries", async () => {
      const logger = new DefaultSiteAuditLogger();
      const log = await logger.recordLog({
        actorId: "actor-123",
        action: "CREATE_PPE_SITE",
        targetType: "PPE_SITE",
        targetId: "site-456",
        details: { name: "Test Site" },
        ipAddress: "127.0.0.1",
        userAgent: "TestAgent",
      });

      assert.equal(log.service, "site-service");
      assert.equal(log.actorId, "actor-123");
      assert.equal(log.action, "CREATE_PPE_SITE");
      assert.equal(log.targetType, "PPE_SITE");
      assert.equal(log.targetId, "site-456");
      assert.ok(log.timestamp);
    });

    it("DefaultSafetyAuditLogger should record structured audit log entries", async () => {
      const logger = new DefaultSafetyAuditLogger();
      const log = await logger.createAuditLog({
        actorId: "actor-789",
        action: "UPDATE_SAFETY_CONFIG",
        targetType: "PPE_SAFETY_CONFIG",
        targetId: "config-101",
        details: { confidenceThreshold: 0.9 },
      });

      assert.equal(log.service, "site-service");
      assert.equal(log.actorId, "actor-789");
      assert.equal(log.action, "UPDATE_SAFETY_CONFIG");
      assert.equal(log.targetType, "PPE_SAFETY_CONFIG");
      assert.equal(log.targetId, "config-101");
      assert.ok(log.timestamp);
    });

    it("SiteService default instance should have active audit logger wired", async () => {
      const recorded: any[] = [];
      const mockAuditLogger = {
        recordLog: async (data: any) => {
          recorded.push(data);
          return data;
        },
      };

      const mockRepo = {
        findSiteByCode: async () => null,
        createSite: async (data: any) => ({
          id: "site-created-id",
          name: data.name,
          code: data.code,
          status: "ACTIVE",
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      };

      const service = new SiteService(mockRepo as any, mockAuditLogger as any);
      await service.createSite(
        { name: "New Construction Site", code: "SITE_NEW_01" } as any,
        "admin-actor-id",
        { id: "admin-actor-id", role: ROLES.ADMIN },
      );

      assert.equal(recorded.length, 1);
      assert.equal(recorded[0].actorId, "admin-actor-id");
      assert.equal(recorded[0].targetId, "site-created-id");
    });

    it("SafetyRuleRepository default instance should wire defaultSafetyAuditLogger", async () => {
      const repo = new SafetyRuleRepository();
      assert.ok((repo as any).rbacRepo);
    });
  });

  // ── SEC-33: Orphaned Duplicate Server Entrypoint Desynchronization ──────────
  describe("SEC-33: ORPHANED-ENTRYPOINT-DESYNCHRONIZATION", () => {
    it("src/site.server.ts must be safely removed to prevent deployment drift", () => {
      const siteServerPath = path.resolve(__dirname, "../src/site.server.ts");
      assert.equal(
        fs.existsSync(siteServerPath),
        false,
        "site.server.ts must be deleted to eliminate redundant entrypoint",
      );
    });

    it("package.json scripts must consistently reference canonical src/server.ts and dist/server.js", () => {
      const packageJsonPath = path.resolve(__dirname, "../package.json");
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

      assert.equal(pkg.main, "dist/server.js");
      assert.equal(pkg.scripts.start, "node dist/server.js");
      assert.ok(pkg.scripts.dev.includes("src/server.ts"));
      assert.equal(pkg.scripts.dev.includes("site.server.ts"), false);
    });

    it("Dockerfile must invoke canonical entrypoint dist/server.js", () => {
      const dockerfilePath = path.resolve(__dirname, "../Dockerfile");
      const dockerfileContent = fs.readFileSync(dockerfilePath, "utf8");

      assert.ok(dockerfileContent.includes('CMD ["node", "dist/server.js"]'));
      assert.equal(dockerfileContent.includes("site.server.js"), false);
    });
  });

  // ── SEC-34: Permissive JSON Parser Body Size Denial of Service ─────────────
  describe("SEC-34: PERMISSIVE-JSON-PARSER-BODY-SIZE-DOS", () => {
    it("site.app.ts must restrict express.json body parser limit to 100kb", () => {
      const appPath = path.resolve(__dirname, "../src/site.app.ts");
      const content = fs.readFileSync(appPath, "utf8");

      assert.ok(
        content.includes('express.json({ limit: "100kb" })'),
        "express.json limit must be set to 100kb",
      );
      assert.equal(content.includes('express.json({ limit: "2mb" })'), false);
    });

    it("site.app.ts must restrict express.urlencoded to extended: false and limit: 50kb", () => {
      const appPath = path.resolve(__dirname, "../src/site.app.ts");
      const content = fs.readFileSync(appPath, "utf8");

      assert.ok(
        content.includes('express.urlencoded({ extended: false, limit: "50kb" })'),
        "express.urlencoded must be extended: false with 50kb limit",
      );
      assert.equal(content.includes('express.urlencoded({ extended: true, limit: "2mb" })'), false);
    });
  });

  // ── SEC-35: Substring Cache Key Collision and O(N) Traversal ───────────────
  describe("SEC-35: SUBSTRING-CACHE-KEY-COLLISION-AND-O-N-TRAVERSAL", () => {
    it("should prevent substring key collisions between cam-1 and cam-10 / cam-100", () => {
      const cache = new SafetyRuleCacheService();

      const configCam10 = {
        siteId: "site-A",
        siteName: "Site A",
        siteCode: "SITE-A",
        effectiveConfig: { confidenceThreshold: 0.99 } as any,
        restrictedAreas: [],
      };

      const configCam1 = {
        siteId: "site-A",
        siteName: "Site A",
        siteCode: "SITE-A",
        effectiveConfig: { confidenceThreshold: 0.55 } as any,
        restrictedAreas: [],
      };

      const configForeignSiteWithSubstring = {
        siteId: "site-cam-1-north",
        siteName: "Foreign Site",
        siteCode: "FS-1",
        effectiveConfig: { confidenceThreshold: 0.11 } as any,
        restrictedAreas: [],
      };

      // Set entries in cache
      cache.set("effective:site:site-A:camera:cam-10", configCam10);
      cache.set("effective:site:site-A:camera:cam-1", configCam1);
      cache.set("effective:site:site-cam-1-north:camera:cam-99", configForeignSiteWithSubstring);

      // Query cam-1: before fix, substring includes("cam-1") would match cam-10 or site-cam-1-north!
      const resultCam1 = cache.getForCamera("cam-1");
      assert.ok(resultCam1);
      assert.equal(resultCam1.effectiveConfig.confidenceThreshold, 0.55);

      // Query cam-10
      const resultCam10 = cache.getForCamera("cam-10");
      assert.ok(resultCam10);
      assert.equal(resultCam10.effectiveConfig.confidenceThreshold, 0.99);

      // Invalidate cam-1: cam-10 must NOT be evicted
      cache.invalidateCamera("cam-1");
      assert.equal(cache.getForCamera("cam-1"), null);
      assert.ok(cache.getForCamera("cam-10"));
      assert.equal(cache.getForCamera("cam-10")?.effectiveConfig.confidenceThreshold, 0.99);
    });

    it("should provide fast O(1) indexed lookup for camera rules", () => {
      const cache = new SafetyRuleCacheService();

      const dummyConfig = {
        siteId: "site-perf",
        siteName: "Perf Site",
        siteCode: "PERF",
        effectiveConfig: { confidenceThreshold: 0.88 } as any,
        restrictedAreas: [],
      };

      cache.set("effective:site:site-perf:camera:cam-fast", dummyConfig);

      // Verify that cameraIndex has the direct key mapping
      assert.ok((cache as any).cameraIndex.has("cam-fast"));
      assert.equal(
        (cache as any).cameraIndex.get("cam-fast"),
        "effective:site:site-perf:camera:cam-fast",
      );

      const found = cache.getForCamera("cam-fast");
      assert.equal(found?.effectiveConfig.confidenceThreshold, 0.88);

      // Invalidate camera clears index as well
      cache.invalidateCamera("cam-fast");
      assert.equal((cache as any).cameraIndex.has("cam-fast"), false);
      assert.equal(cache.getForCamera("cam-fast"), null);
    });
  });

  // ── SEC-36: Express trust proxy configuration ──────────────────────────────
  describe("SEC-36: TRUST-PROXY-IP-SPOOFING-RATE-LIMIT-BYPASS", () => {
    it("should parse 'true' as 1 hop to trust only immediate reverse proxy", () => {
      assert.equal(parseTrustProxy("true"), 1);
    });

    it("should parse 'false' and undefined as false", () => {
      assert.equal(parseTrustProxy("false"), false);
      assert.equal(parseTrustProxy(undefined), false);
      assert.equal(parseTrustProxy(""), false);
    });

    it("should parse custom hop number correctly", () => {
      assert.equal(parseTrustProxy("2"), 2);
      assert.equal(parseTrustProxy("0"), 0);
    });

    it("should preserve custom subnet or host expressions", () => {
      assert.equal(parseTrustProxy("loopback"), "loopback");
      assert.equal(parseTrustProxy("127.0.0.1"), "127.0.0.1");
    });
  });

  // ── SEC-37: Database connection starvation via health check ───────────────
  describe("SEC-37: UNBOUNDED-HEALTH-CHECK-DB-STARVATION", () => {
    before(() => {
      resetDatabaseHealthCache();
    });

    it("should cache successful database health checks within DB_HEALTH_CACHE_TTL_MS", async () => {
      resetDatabaseHealthCache();
      let queryCallCount = 0;
      const mockQuery = async () => {
        queryCallCount++;
        return 1;
      };

      const res1 = await checkDatabaseHealth(false, mockQuery);
      assert.equal(res1, true);
      assert.equal(queryCallCount, 1);

      // Subsequent calls within TTL should use cached result without re-executing query
      const res2 = await checkDatabaseHealth(false, mockQuery);
      const res3 = await checkDatabaseHealth(false, mockQuery);
      assert.equal(res2, true);
      assert.equal(res3, true);
      assert.equal(queryCallCount, 1);
    });

    it("should query database again after resetDatabaseHealthCache", async () => {
      resetDatabaseHealthCache();
      let queryCallCount = 0;
      const mockQuery = async () => {
        queryCallCount++;
        return 1;
      };

      await checkDatabaseHealth(false, mockQuery);
      assert.equal(queryCallCount, 1);

      resetDatabaseHealthCache();
      await checkDatabaseHealth(false, mockQuery);
      assert.equal(queryCallCount, 2);
    });

    it("should handle database error gracefully and return false", async () => {
      resetDatabaseHealthCache();
      const failingQuery = async () => {
        throw new Error("DB Connection timed out");
      };

      const result = await checkDatabaseHealth(true, failingQuery);
      assert.equal(result, false);
    });
  });

  // ── SEC-38: Unbounded pagination offset resource exhaustion ────────────────
  describe("SEC-38: UNBOUNDED-PAGINATION-OFFSET-RESOURCE-EXHAUSTION-DOS", () => {
    it("should cap page calculation to MAX_PAGE and MAX_PAGINATION_SKIP in helper", () => {
      assert.equal(calculatePaginationSkip(1, 20).skip, 0);
      assert.equal(calculatePaginationSkip(2, 20).skip, 20);
      assert.equal(calculatePaginationSkip(MAX_PAGE, 20).skip, (MAX_PAGE - 1) * 20);

      // Huge page exceeding MAX_PAGE should be clamped to MAX_PAGE
      const skipHuge = calculatePaginationSkip(99999999, 20);
      assert.equal(skipHuge.skip, (MAX_PAGE - 1) * 20);
      assert.equal(skipHuge.page, MAX_PAGE);

      // Limit is capped to MAX_PAGINATION_LIMIT (100)
      const skipCapped = calculatePaginationSkip(MAX_PAGE, 500);
      assert.equal(skipCapped.limit, 100);
      assert.equal(skipCapped.skip, (MAX_PAGE - 1) * 100);
    });

    it("should validate and reject page > 10000 in siteQuerySchema", () => {
      const valid = siteQuerySchema.safeParse({ page: "10000", limit: "20" });
      assert.equal(valid.success, true);

      const invalid = siteQuerySchema.safeParse({ page: "10001", limit: "20" });
      assert.equal(invalid.success, false);
      if (!invalid.success) {
        assert.ok(
          invalid.error.errors.some((e) =>
            e.message.includes("Số trang không được vượt quá 10,000"),
          ),
        );
      }
    });

    it("should validate and reject page > 10000 in zoneQuerySchema", () => {
      const valid = zoneQuerySchema.safeParse({ page: "10000", limit: "20" });
      assert.equal(valid.success, true);

      const invalid = zoneQuerySchema.safeParse({ page: "50000", limit: "20" });
      assert.equal(invalid.success, false);
    });

    it("should validate and reject page > 10000 in restrictedAreaQuerySchema", () => {
      const valid = restrictedAreaQuerySchema.safeParse({ page: "10000", limit: "20" });
      assert.equal(valid.success, true);

      const invalid = restrictedAreaQuerySchema.safeParse({ page: "10000000", limit: "20" });
      assert.equal(invalid.success, false);
    });
  });

  // ── SEC-39: Unrestricted polygon coordinates DoS ───────────────────────────
  describe("SEC-39: UNRESTRICTED-POLYGON-COORDINATES-DOS", () => {
    it("should accept valid polygon coordinates within 0 to 100,000", () => {
      const point = polygonPointSchema.safeParse({ x: 100, y: 250 });
      assert.equal(point.success, true);

      const maxPoint = polygonPointSchema.safeParse({ x: 100000, y: 100000 });
      assert.equal(maxPoint.success, true);
    });

    it("should reject negative coordinates", () => {
      const negative = polygonPointSchema.safeParse({ x: -1, y: 10 });
      assert.equal(negative.success, false);
    });

    it("should reject coordinates exceeding 100,000 or arbitrary large numbers", () => {
      const exceedX = polygonPointSchema.safeParse({ x: 100001, y: 50 });
      assert.equal(exceedX.success, false);
      if (!exceedX.success) {
        assert.ok(
          exceedX.error.errors.some((e) =>
            e.message.includes("Tọa độ x không được vượt quá 100,000"),
          ),
        );
      }

      const exceedY = polygonPointSchema.safeParse({ x: 50, y: 1e300 });
      assert.equal(exceedY.success, false);
      if (!exceedY.success) {
        assert.ok(
          exceedY.error.errors.some((e) =>
            e.message.includes("Tọa độ y không được vượt quá 100,000"),
          ),
        );
      }
    });

    it("should reject createRestrictedAreaSchema when boundary points exceed 100,000", () => {
      const result = createRestrictedAreaSchema.safeParse({
        name: "Test Restricted Area",
        boundary: [
          { x: 0, y: 0 },
          { x: 100001, y: 0 },
          { x: 50, y: 50 },
        ],
      });
      assert.equal(result.success, false);
    });
  });
});


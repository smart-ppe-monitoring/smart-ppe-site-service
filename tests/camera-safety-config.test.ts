import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createSiteSchema, updateSiteSchema } from "../src/modules/site/site.validation";
import {
  updateCameraSafetyConfigSchema,
  updateSiteSafetyConfigSchema,
  effectiveSafetyConfigQuerySchema,
} from "../src/modules/safety-rule/safety-rule.validation";
import { SafetyRuleService } from "../src/modules/safety-rule/safety-rule.service";
import { SafetyRuleCacheService } from "../src/modules/safety-rule/safety-rule-cache.service";
import { CONFIG_RESOLUTION_SOURCE } from "../src/modules/safety-rule/safety-rule.constant";

describe("Camera Safety Config & Contact Officers Suite", () => {
  // ── 1. Contact Officers Schema Validation ──────────────────────────────────
  describe("1. Site Contact Officers Validation", () => {
    it("should accept site creation payload with contactOfficers", () => {
      const payload = {
        name: "Công trường Vinhomes Green Bay",
        code: "VH-GB-01",
        contactPerson: "Nguyễn Văn An",
        contactPhone: "0901234567",
        contactOfficers: [
          {
            name: "Nguyễn Văn An",
            role: "Trưởng ban An toàn",
            phone: "0901234567",
            email: "an.nguyen@example.com",
            isPrimary: true,
          },
          {
            name: "Trần Thị Bình",
            role: "Kỹ sư HSE",
            phone: "0912345678",
            email: "binh.tran@example.com",
            isPrimary: false,
          },
        ],
      };

      const result = createSiteSchema.safeParse(payload);
      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.contactOfficers?.length, 2);
        assert.equal(result.data.contactOfficers?.[0].name, "Nguyễn Văn An");
        assert.equal(result.data.contactOfficers?.[0].isPrimary, true);
      }
    });

    it("should reject contactOfficers with invalid phone or email", () => {
      const invalidPayload = {
        name: "Công trường Test",
        code: "CT-TEST",
        contactOfficers: [
          {
            name: "Lê Văn C",
            role: "HSE",
            phone: "invalid-phone",
            email: "invalid-email",
          },
        ],
      };

      const result = createSiteSchema.safeParse(invalidPayload);
      assert.equal(result.success, false);
    });

    it("should allow partial update of contactOfficers in updateSiteSchema", () => {
      const updatePayload = {
        contactPerson: "Đỗ Minh Đức",
        contactOfficers: [
          {
            name: "Đỗ Minh Đức",
            role: "Giám sát viên",
            phone: "0987654321",
          },
        ],
      };

      const result = updateSiteSchema.safeParse(updatePayload);
      assert.equal(result.success, true);
    });

    it("should reject contactOfficers array exceeding 50 items (DoS prevention)", () => {
      const officers = Array.from({ length: 51 }, (_, i) => ({
        name: `Officer ${i}`,
        phone: "0901234567",
      }));

      const result = createSiteSchema.safeParse({
        name: "Công trường Large",
        code: "CT-LARGE",
        contactOfficers: officers,
      });

      assert.equal(result.success, false);
    });

    it("should reject phones array exceeding 10 items (DoS prevention)", () => {
      const phones = Array.from({ length: 11 }, () => "0901234567");

      const result = createSiteSchema.safeParse({
        name: "Công trường Phone DoS",
        code: "CT-PHONE",
        contactOfficers: [
          {
            name: "Officer",
            phones,
          },
        ],
      });

      assert.equal(result.success, false);
    });
  });

  // ── 2. Camera Safety Config Schemas ───────────────────────────────────────
  describe("2. Safety Config Float Duration & AI Thresholds", () => {
    it("should accept float confirmationDuration in updateCameraSafetyConfigSchema", () => {
      const payload = {
        confidenceThreshold: 0.55,
        confirmationDuration: 4.0,
        cooldownDuration: 30,
        enableNoHelmet: true,
        enableNoVest: false,
        modelVersionId: "best.pt",
      };

      const result = updateCameraSafetyConfigSchema.safeParse(payload);
      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.confirmationDuration, 4.0);
        assert.equal(result.data.confidenceThreshold, 0.55);
        assert.equal(result.data.modelVersionId, "best.pt");
      }
    });

    it("should accept fractional seconds like 1.5s in updateSiteSafetyConfigSchema", () => {
      const payload = {
        confirmationDuration: 1.5,
        confidenceThreshold: 0.6,
        modelVersionId: "yolo11n-ppe-v2",
      };

      const result = updateSiteSafetyConfigSchema.safeParse(payload);
      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.confirmationDuration, 1.5);
        assert.equal(result.data.modelVersionId, "yolo11n-ppe-v2");
      }
    });

    it("should reject modelVersionId containing path traversal or illegal characters", () => {
      const pathTraversal = {
        modelVersionId: "../../etc/passwd",
      };
      assert.equal(updateCameraSafetyConfigSchema.safeParse(pathTraversal).success, false);
      assert.equal(updateSiteSafetyConfigSchema.safeParse(pathTraversal).success, false);

      const illegalChars = {
        modelVersionId: "model;rm -rf /",
      };
      assert.equal(updateCameraSafetyConfigSchema.safeParse(illegalChars).success, false);
    });
  });

  // ── 3. SafetyRuleService Camera Override & Resolution ─────────────────────
  describe("3. Camera Safety Config Layered Resolution & Hardware Merging", () => {
    it("should resolve camera override with hardware config (roiPolygon, captureFps, motionSensitivity)", async () => {
      const mockCameraClient = {
        findCameraById: async (id: string) => ({
          id,
          siteId: "site-1",
          name: "CAM-01 Entrance",
          code: "CAM-01",
          zoneId: "zone-1",
          status: "ACTIVE",
        }),
        findCameraConfig: async (id: string) => ({
          id: `hw-${id}`,
          cameraId: id,
          captureFps: 15,
          roiPolygon: [
            { x: 10, y: 10 },
            { x: 100, y: 10 },
            { x: 100, y: 100 },
            { x: 10, y: 100 },
          ],
          motionSensitivity: 80,
        }),
      };

      const mockReportingClient = {
        findActiveModelVersion: async (id?: string | null) =>
          id
            ? {
                id,
                name: "YOLO11m-PPE (best.pt)",
                weightsFile: "best.pt",
                isActive: true,
              }
            : null,
      };

      // Mock repo có CameraSafetyConfig riêng trong Site DB (Cách 1)
      const mockRepo = {
        findSiteById: async (id: string) => ({
          id,
          name: "Site Alpha",
          code: "SITE-ALPHA",
        }),
        findSiteSafetyConfig: async (siteId: string) => ({
          siteId,
          confidenceThreshold: 0.8,
          confirmationDuration: 3.0,
          cooldownDuration: 30,
          enableNoHelmet: true,
          enableNoVest: true,
          enableRestrictedArea: true,
          modelVersionId: "default.pt",
        }),
        findCameraSafetyConfig: async (cameraId: string) => ({
          id: "cam-safety-1",
          cameraId,
          confidenceThreshold: 0.55,
          confirmationDuration: 4.0,
          cooldownDuration: 25,
          enableNoHelmet: true,
          enableNoVest: false, // Override: Không kiểm tra áo ở camera này
          enableRestrictedArea: null,
          modelVersionId: "best.pt",
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

      const effective = await service.getEffectiveConfig({
        siteId: "site-1",
        cameraId: "cam-1",
      });

      // 1. Kiểm tra ưu tiên Camera Override
      assert.equal(effective.source, CONFIG_RESOLUTION_SOURCE.CAMERA_OVERRIDE);
      assert.equal(effective.confidenceThreshold, 0.55);
      assert.equal(effective.confirmationDuration, 4.0);
      assert.equal(effective.cooldownDuration, 25);
      assert.equal(effective.rules.enableNoHelmet, true);
      assert.equal(effective.rules.enableNoVest, false); // Đã override tắt kiểm tra áo!
      assert.equal(effective.rules.enableRestrictedArea, true); // Kế thừa từ site
      assert.equal(effective.modelVersion?.id, "best.pt");

      // 2. Kiểm tra thông tin phần cứng stream được merge đầy đủ
      assert.equal(effective.captureFps, 15);
      assert.equal(effective.motionSensitivity, 80);
      assert.ok(Array.isArray(effective.roiPolygon));
      assert.equal(effective.roiPolygon.length, 4);
    });

    it("should fallback to Site Level safety config when camera has no override", async () => {
      const mockCameraClient = {
        findCameraById: async (id: string) => ({
          id,
          siteId: "site-2",
          name: "CAM-02 Gate",
          code: "CAM-02",
          zoneId: null,
          status: "ACTIVE",
        }),
        findCameraConfig: async (id: string) => ({
          id: `hw-${id}`,
          cameraId: id,
          captureFps: 10,
          roiPolygon: null,
          motionSensitivity: 75,
        }),
      };

      const mockReportingClient = {
        findActiveModelVersion: async () => null,
      };

      const mockRepo = {
        findSiteById: async (id: string) => ({
          id,
          name: "Site Beta",
          code: "SITE-BETA",
        }),
        findSiteSafetyConfig: async (siteId: string) => ({
          siteId,
          confidenceThreshold: 0.7,
          confirmationDuration: 2.5,
          cooldownDuration: 40,
          enableNoHelmet: true,
          enableNoVest: true,
          enableRestrictedArea: false,
          modelVersionId: null,
        }),
        findCameraSafetyConfig: async () => null, // Không có override
        findRestrictedAreas: async () => [],
      };

      const cache = new SafetyRuleCacheService();
      const service = new SafetyRuleService(
        mockRepo as any,
        mockCameraClient as any,
        mockReportingClient as any,
        cache,
      );

      const effective = await service.getEffectiveConfig({
        siteId: "site-2",
        cameraId: "cam-2",
      });

      assert.equal(effective.source, CONFIG_RESOLUTION_SOURCE.SITE_LEVEL);
      assert.equal(effective.confidenceThreshold, 0.7);
      assert.equal(effective.confirmationDuration, 2.5);
      assert.equal(effective.cooldownDuration, 40);
      assert.equal(effective.rules.enableNoHelmet, true);
      assert.equal(effective.rules.enableNoVest, true);
      assert.equal(effective.rules.enableRestrictedArea, false);
      assert.equal(effective.captureFps, 10);
      assert.equal(effective.motionSensitivity, 75);
    });
  });
});


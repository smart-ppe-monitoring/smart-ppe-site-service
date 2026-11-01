import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import {
  SafetyRuleRepository,
  safetyRuleRepository,
} from "./safety-rule.repository";
import {
  SafetyRuleCacheService,
  safetyRuleCacheService,
} from "./safety-rule-cache.service";
import {
  CameraServiceClient,
  cameraServiceClient,
  ReportingServiceClient,
  reportingServiceClient,
} from "../../clients";
import {
  UpdateSiteSafetyConfigDto,
  UpdateCameraSafetyConfigDto,
  EffectiveSafetyConfigQueryDto,
  EffectiveSafetyConfigResultDto,
  SiteSafetyConfigItemDto,
  CameraSafetyConfigItemDto,
} from "./safety-rule.dto";
import {
  DEFAULT_SAFETY_CONFIG,
  CONFIG_RESOLUTION_SOURCE,
  ConfigResolutionSource,
} from "./safety-rule.constant";
import { AUDIT_ACTION } from "../../common/constants/audit-log.constant";

/**
 * SafetyRuleService — Tầng nghiệp vụ điều phối quy tắc an toàn PPE
 *
 * Tuân thủ Clean Architecture:
 * - Điều phối dữ liệu CSDL Site nội bộ qua SafetyRuleRepository.
 * - Điều phối dữ liệu ngoại vi qua CameraServiceClient và ReportingServiceClient.
 * - Quản lý phân tầng thừa kế cấu hình: Camera Override -> Site Config -> System Default.
 * - Quản lý bộ đệm phân cấp SafetyRuleCacheService.
 */
export class SafetyRuleService {
  private readonly repository: SafetyRuleRepository;
  private readonly cameraClient: CameraServiceClient;
  private readonly reportingClient: ReportingServiceClient;
  private readonly cache: SafetyRuleCacheService;

  constructor(
    repository?: SafetyRuleRepository,
    cameraClient?: CameraServiceClient,
    reportingClient?: ReportingServiceClient,
    cache?: SafetyRuleCacheService,
  ) {
    this.repository = repository || safetyRuleRepository;
    this.cameraClient = cameraClient || cameraServiceClient;
    this.reportingClient = reportingClient || reportingServiceClient;
    this.cache = cache || safetyRuleCacheService;
  }

  // ── 1. System Default ──────────────────────────────────────────────────────
  getSystemDefault() {
    return {
      confidenceThreshold: DEFAULT_SAFETY_CONFIG.confidenceThreshold,
      confirmationDuration: DEFAULT_SAFETY_CONFIG.confirmationDuration,
      cooldownDuration: DEFAULT_SAFETY_CONFIG.cooldownDuration,
      rules: {
        enableNoHelmet: DEFAULT_SAFETY_CONFIG.enableNoHelmet,
        enableNoVest: DEFAULT_SAFETY_CONFIG.enableNoVest,
        enableRestrictedArea: DEFAULT_SAFETY_CONFIG.enableRestrictedArea,
      },
      modelVersionId: DEFAULT_SAFETY_CONFIG.modelVersionId,
      source: CONFIG_RESOLUTION_SOURCE.SYSTEM_DEFAULT,
    };
  }

  // ── 2. Site Safety Config ──────────────────────────────────────────────────
  async getSiteSafetyConfig(siteId: string): Promise<SiteSafetyConfigItemDto> {
    const site = await this.repository.findSiteById(siteId);
    if (!site) {
      throw new AppError(
        "Không tìm thấy công trường",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    let config = await this.repository.findSiteSafetyConfig(siteId);
    if (!config) {
      config = await this.repository.upsertSiteSafetyConfig(siteId, {
        confidenceThreshold: DEFAULT_SAFETY_CONFIG.confidenceThreshold,
        confirmationDuration: DEFAULT_SAFETY_CONFIG.confirmationDuration,
        cooldownDuration: DEFAULT_SAFETY_CONFIG.cooldownDuration,
        enableNoHelmet: DEFAULT_SAFETY_CONFIG.enableNoHelmet,
        enableNoVest: DEFAULT_SAFETY_CONFIG.enableNoVest,
        enableRestrictedArea: DEFAULT_SAFETY_CONFIG.enableRestrictedArea,
      });
    }

    return {
      id: config.id,
      siteId: config.siteId,
      confidenceThreshold: Number(config.confidenceThreshold),
      confirmationDuration: config.confirmationDuration,
      cooldownDuration: config.cooldownDuration,
      enableNoHelmet: config.enableNoHelmet,
      enableNoVest: config.enableNoVest,
      enableRestrictedArea: config.enableRestrictedArea,
      modelVersionId: config.modelVersionId,
      updatedBy: config.updatedBy,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString(),
    };
  }

  async updateSiteSafetyConfig(
    siteId: string,
    data: UpdateSiteSafetyConfigDto,
    actorId?: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<SiteSafetyConfigItemDto> {
    const site = await this.repository.findSiteById(siteId);
    if (!site) {
      throw new AppError(
        "Không tìm thấy công trường",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    if (data.modelVersionId) {
      const modelVersion = await this.reportingClient.findActiveModelVersion(
        data.modelVersionId,
      );
      if (!modelVersion) {
        throw new AppError(
          "Không tìm thấy phiên bản mô hình AI được chỉ định",
          404,
          ERROR_CODE.NOT_FOUND,
        );
      }
    }

    const updated = await this.repository.upsertSiteSafetyConfig(
      siteId,
      data,
      actorId,
    );

    // Xóa cache liên quan đến site này
    this.cache.invalidateSite(siteId);

    // Ghi nhận Audit Log
    await this.repository.recordAuditLog({
      actorId,
      action: AUDIT_ACTION.UPDATE_PPE_SAFETY_CONFIG,
      targetId: siteId,
      details: {
        siteName: site.name,
        siteCode: site.code,
        changes: data,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      id: updated.id,
      siteId: updated.siteId,
      confidenceThreshold: Number(updated.confidenceThreshold),
      confirmationDuration: updated.confirmationDuration,
      cooldownDuration: updated.cooldownDuration,
      enableNoHelmet: updated.enableNoHelmet,
      enableNoVest: updated.enableNoVest,
      enableRestrictedArea: updated.enableRestrictedArea,
      modelVersionId: updated.modelVersionId,
      updatedBy: updated.updatedBy,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  // ── 3. Camera Safety Config Overrides ──────────────────────────────────────
  async getCameraSafetyConfig(
    cameraId: string,
    token?: string,
  ): Promise<CameraSafetyConfigItemDto> {
    const camera = await this.cameraClient.findCameraById(cameraId, token);
    if (!camera) {
      throw new AppError("Không tìm thấy camera", 404, ERROR_CODE.NOT_FOUND);
    }

    // 1. Tìm trong DB nội bộ của Site Service (Cách 1)
    const config =
      typeof this.repository.findCameraSafetyConfig === "function"
        ? await this.repository.findCameraSafetyConfig(cameraId)
        : null;

    if (!config) {
      // Fallback sang cameraClient nếu có dữ liệu legacy
      const remote = await this.cameraClient.findCameraConfig(cameraId, token);
      if (remote && (remote.confidenceThreshold !== undefined || remote.enableNoHelmet !== undefined)) {
        return {
          id: remote.id,
          cameraId: remote.cameraId,
          confidenceThreshold:
            remote.confidenceThreshold !== null && remote.confidenceThreshold !== undefined
              ? Number(remote.confidenceThreshold)
              : null,
          confirmationDuration:
            remote.confirmationDuration !== null && remote.confirmationDuration !== undefined
              ? Number(remote.confirmationDuration)
              : null,
          cooldownDuration: remote.cooldownDuration ?? null,
          enableNoHelmet: remote.enableNoHelmet ?? null,
          enableNoVest: remote.enableNoVest ?? null,
          enableRestrictedArea: remote.enableRestrictedArea ?? null,
          modelVersionId: remote.modelVersionId ?? null,
          createdAt: (remote.createdAt instanceof Date ? remote.createdAt : new Date(remote.createdAt || Date.now())).toISOString(),
          updatedAt: (remote.updatedAt instanceof Date ? remote.updatedAt : new Date(remote.updatedAt || Date.now())).toISOString(),
        };
      }

      return {
        id: "",
        cameraId,
        confidenceThreshold: null,
        confirmationDuration: null,
        cooldownDuration: null,
        enableNoHelmet: null,
        enableNoVest: null,
        enableRestrictedArea: null,
        modelVersionId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    return {
      id: config.id,
      cameraId: config.cameraId,
      confidenceThreshold:
        config.confidenceThreshold !== null && config.confidenceThreshold !== undefined
          ? Number(config.confidenceThreshold)
          : null,
      confirmationDuration:
        config.confirmationDuration !== null && config.confirmationDuration !== undefined
          ? Number(config.confirmationDuration)
          : null,
      cooldownDuration: config.cooldownDuration ?? null,
      enableNoHelmet: config.enableNoHelmet ?? null,
      enableNoVest: config.enableNoVest ?? null,
      enableRestrictedArea: config.enableRestrictedArea ?? null,
      modelVersionId: config.modelVersionId ?? null,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString(),
    };
  }

  async updateCameraSafetyConfig(
    cameraId: string,
    data: UpdateCameraSafetyConfigDto,
    actorId?: string,
    meta?: { ipAddress?: string; userAgent?: string },
    token?: string,
  ): Promise<CameraSafetyConfigItemDto> {
    const camera = await this.cameraClient.findCameraById(cameraId, token);
    if (!camera) {
      throw new AppError("Không tìm thấy camera", 404, ERROR_CODE.NOT_FOUND);
    }

    if (data.modelVersionId) {
      const modelVersion = await this.reportingClient.findActiveModelVersion(
        data.modelVersionId,
        token,
      );
      if (!modelVersion) {
        throw new AppError(
          "Không tìm thấy phiên bản mô hình AI được chỉ định",
          404,
          ERROR_CODE.NOT_FOUND,
        );
      }
    }

    let updated: any = null;
    if (typeof this.repository.upsertCameraSafetyConfig === "function") {
      updated = await this.repository.upsertCameraSafetyConfig(
        cameraId,
        data,
        actorId,
      );
    } else {
      updated = await this.cameraClient.upsertCameraSafetyConfig(
        cameraId,
        data,
        token,
      );
    }

    if (!updated) {
      throw new AppError(
        "Không thể cập nhật cấu hình an toàn cho camera",
        500,
        ERROR_CODE.INTERNAL_SERVER_ERROR,
      );
    }

    // Xóa cache cho camera này
    this.cache.invalidateCamera(cameraId);

    // Ghi nhận Audit Log
    await this.repository.recordAuditLog({
      actorId,
      action: AUDIT_ACTION.UPDATE_PPE_CAMERA_SAFETY_CONFIG,
      targetId: cameraId,
      details: {
        cameraName: camera.name,
        cameraCode: camera.code,
        changes: data,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      id: updated.id,
      cameraId: updated.cameraId,
      confidenceThreshold:
        updated.confidenceThreshold !== null && updated.confidenceThreshold !== undefined
          ? Number(updated.confidenceThreshold)
          : null,
      confirmationDuration:
        updated.confirmationDuration !== null && updated.confirmationDuration !== undefined
          ? Number(updated.confirmationDuration)
          : null,
      cooldownDuration: updated.cooldownDuration ?? null,
      enableNoHelmet: updated.enableNoHelmet ?? null,
      enableNoVest: updated.enableNoVest ?? null,
      enableRestrictedArea: updated.enableRestrictedArea ?? null,
      modelVersionId: updated.modelVersionId ?? null,
      createdAt: (updated.createdAt instanceof Date ? updated.createdAt : new Date(updated.createdAt || Date.now())).toISOString(),
      updatedAt: (updated.updatedAt instanceof Date ? updated.updatedAt : new Date(updated.updatedAt || Date.now())).toISOString(),
    };
  }

  async deleteCameraSafetyConfig(
    cameraId: string,
    actorId?: string,
    meta?: { ipAddress?: string; userAgent?: string },
    token?: string,
  ): Promise<void> {
    const camera = await this.cameraClient.findCameraById(cameraId, token);
    if (!camera) {
      throw new AppError("Không tìm thấy camera", 404, ERROR_CODE.NOT_FOUND);
    }

    if (typeof this.repository.deleteCameraSafetyConfig === "function") {
      await this.repository.deleteCameraSafetyConfig(cameraId);
    }
    try {
      await this.cameraClient.clearCameraSafetyConfig(cameraId, token);
    } catch {
      // Ignored
    }
    this.cache.invalidateCamera(cameraId);

    await this.repository.recordAuditLog({
      actorId,
      action: AUDIT_ACTION.DELETE_PPE_CAMERA_SAFETY_CONFIG,
      targetId: cameraId,
      details: {
        cameraName: camera.name,
        cameraCode: camera.code,
        message: "Đã xóa toàn bộ cấu hình override và quay về kế thừa từ Site",
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });
  }

  // ── 4. Effective Safety & AI Config Resolution (Trọng tâm BE-10) ───────────
  async getEffectiveConfig(
    query: EffectiveSafetyConfigQueryDto,
    token?: string,
  ): Promise<EffectiveSafetyConfigResultDto> {
    const cached = query.cameraId
      ? this.cache.getForCamera(query.cameraId)
      : query.siteId
        ? this.cache.get(`effective:site:${query.siteId}`)
        : null;

    if (cached) {
      if (query.siteId && cached.siteId !== query.siteId) {
        throw new AppError(
          "Camera không thuộc công trường được chỉ định",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }
      return cached;
    }

    let siteId = query.siteId;
    let camera: any = null;
    let cameraSafetyOverride: any = null;
    let cameraHardware: any = null;
    let isCameraOverride = false;

    if (query.cameraId) {
      camera = await this.cameraClient.findCameraById(query.cameraId, token);
      if (!camera) {
        throw new AppError("Không tìm thấy camera", 404, ERROR_CODE.NOT_FOUND);
      }
      if (query.siteId && camera.siteId !== query.siteId) {
        throw new AppError(
          "Camera không thuộc công trường được chỉ định",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }
      siteId = camera.siteId;

      const [localSafety, hardware] = await Promise.all([
        typeof this.repository.findCameraSafetyConfig === "function"
          ? this.repository.findCameraSafetyConfig(query.cameraId)
          : Promise.resolve(null),
        this.cameraClient.findCameraConfig(query.cameraId, token),
      ]);
      cameraSafetyOverride = localSafety;
      cameraHardware = hardware;
    }

    if (!siteId) {
      throw new AppError(
        "Không xác định được công trường",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const site = await this.repository.findSiteById(siteId);
    if (!site) {
      throw new AppError(
        "Không tìm thấy công trường",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    const siteConfig = await this.repository.findSiteSafetyConfig(siteId);
    const cameraConfig = cameraSafetyOverride || cameraHardware;

    // Kiểm tra xem camera có trường override nào không
    if (
      cameraConfig &&
      (cameraConfig.confidenceThreshold !== null && cameraConfig.confidenceThreshold !== undefined ||
        cameraConfig.confirmationDuration !== null && cameraConfig.confirmationDuration !== undefined ||
        cameraConfig.cooldownDuration !== null && cameraConfig.cooldownDuration !== undefined ||
        cameraConfig.enableNoHelmet !== null && cameraConfig.enableNoHelmet !== undefined ||
        cameraConfig.enableNoVest !== null && cameraConfig.enableNoVest !== undefined ||
        cameraConfig.enableRestrictedArea !== null && cameraConfig.enableRestrictedArea !== undefined ||
        cameraConfig.modelVersionId !== null && cameraConfig.modelVersionId !== undefined)
    ) {
      isCameraOverride = true;
    }

    // Thứ bậc phân giải: Camera Override -> Site Level -> System Default
    const confidenceThreshold =
      cameraConfig?.confidenceThreshold !== null &&
      cameraConfig?.confidenceThreshold !== undefined
        ? Number(cameraConfig.confidenceThreshold)
        : siteConfig?.confidenceThreshold !== undefined &&
            siteConfig?.confidenceThreshold !== null
          ? Number(siteConfig.confidenceThreshold)
          : DEFAULT_SAFETY_CONFIG.confidenceThreshold;

    const confirmationDuration =
      cameraConfig?.confirmationDuration !== null &&
      cameraConfig?.confirmationDuration !== undefined
        ? Number(cameraConfig.confirmationDuration)
        : (siteConfig?.confirmationDuration ??
          DEFAULT_SAFETY_CONFIG.confirmationDuration);

    const cooldownDuration =
      cameraConfig?.cooldownDuration !== null &&
      cameraConfig?.cooldownDuration !== undefined
        ? cameraConfig.cooldownDuration
        : (siteConfig?.cooldownDuration ??
          DEFAULT_SAFETY_CONFIG.cooldownDuration);

    const enableNoHelmet =
      cameraConfig?.enableNoHelmet !== null &&
      cameraConfig?.enableNoHelmet !== undefined
        ? cameraConfig.enableNoHelmet
        : (siteConfig?.enableNoHelmet ?? DEFAULT_SAFETY_CONFIG.enableNoHelmet);

    const enableNoVest =
      cameraConfig?.enableNoVest !== null &&
      cameraConfig?.enableNoVest !== undefined
        ? cameraConfig.enableNoVest
        : (siteConfig?.enableNoVest ?? DEFAULT_SAFETY_CONFIG.enableNoVest);

    const enableRestrictedArea =
      cameraConfig?.enableRestrictedArea !== null &&
      cameraConfig?.enableRestrictedArea !== undefined
        ? cameraConfig.enableRestrictedArea
        : (siteConfig?.enableRestrictedArea ??
          DEFAULT_SAFETY_CONFIG.enableRestrictedArea);

    const targetModelVersionId =
      cameraConfig?.modelVersionId ?? siteConfig?.modelVersionId ?? null;

    let source: ConfigResolutionSource = CONFIG_RESOLUTION_SOURCE.SYSTEM_DEFAULT;
    if (isCameraOverride) {
      source = CONFIG_RESOLUTION_SOURCE.CAMERA_OVERRIDE;
    } else if (siteConfig) {
      source = CONFIG_RESOLUTION_SOURCE.SITE_LEVEL;
    }

    // Đồng thời resolve model version và restricted areas
    const [modelVersion, restrictedAreas] = await Promise.all([
      this.reportingClient.findActiveModelVersion(targetModelVersionId, token),
      this.repository.findRestrictedAreas(siteId, camera?.zoneId),
    ]);

    const captureFps = cameraHardware?.captureFps ?? null;
    const roiPolygon = cameraHardware?.roiPolygon ?? null;
    const motionSensitivity = cameraHardware?.motionSensitivity ?? null;

    const result: EffectiveSafetyConfigResultDto = {
      siteId,
      siteName: site.name,
      siteCode: site.code,
      cameraId: camera ? camera.id : null,
      cameraName: camera ? camera.name : null,
      cameraCode: camera ? camera.code : null,
      confidenceThreshold,
      confirmationDuration,
      cooldownDuration,
      rules: {
        enableNoHelmet,
        enableNoVest,
        enableRestrictedArea,
      },
      modelVersion,
      restrictedAreas,
      source,
      resolvedAt: new Date().toISOString(),
      captureFps,
      roiPolygon,
      motionSensitivity,
    };

    // Cache kết quả với hierarchical key để khi invalidate site sẽ tự động dọn sạch camera
    const finalCacheKey = camera
      ? `effective:site:${siteId}:camera:${camera.id}`
      : `effective:site:${siteId}`;
    this.cache.set(finalCacheKey, result);

    return result;
  }

  // ── 5. Cache Management ───────────────────────────────────────────────────
  clearCache(siteId?: string, cameraId?: string): void {
    if (cameraId) {
      this.cache.invalidateCamera(cameraId);
    } else if (siteId) {
      this.cache.invalidateSite(siteId);
    } else {
      // SEC-15: Prevent unconstrained company-wide cache purge triggering DB stampede
      throw new AppError(
        "Phải cung cấp ít nhất siteId hoặc cameraId để xóa cache",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }
  }
}

export const safetyRuleService = new SafetyRuleService();

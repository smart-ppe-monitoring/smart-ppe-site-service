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

export class SafetyRuleService {
  private readonly repository: SafetyRuleRepository;
  private readonly cache: SafetyRuleCacheService;

  constructor(
    repository?: SafetyRuleRepository,
    cache?: SafetyRuleCacheService,
  ) {
    this.repository = repository || safetyRuleRepository;
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
      const modelVersion = await this.repository.findActiveModelVersion(
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
  ): Promise<CameraSafetyConfigItemDto> {
    const camera = await this.repository.findCameraById(cameraId);
    if (!camera) {
      throw new AppError("Không tìm thấy camera", 404, ERROR_CODE.NOT_FOUND);
    }

    const config = await this.repository.findCameraConfig(cameraId);
    if (!config) {
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
        config.confidenceThreshold !== null
          ? Number(config.confidenceThreshold)
          : null,
      confirmationDuration: config.confirmationDuration ?? null,
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
  ): Promise<CameraSafetyConfigItemDto> {
    const camera = await this.repository.findCameraById(cameraId);
    if (!camera) {
      throw new AppError("Không tìm thấy camera", 404, ERROR_CODE.NOT_FOUND);
    }

    if (data.modelVersionId) {
      const modelVersion = await this.repository.findActiveModelVersion(
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

    const updated = await this.repository.upsertCameraSafetyConfig(
      cameraId,
      data,
    );

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
        updated.confidenceThreshold !== null
          ? Number(updated.confidenceThreshold)
          : null,
      confirmationDuration: updated.confirmationDuration ?? null,
      cooldownDuration: updated.cooldownDuration ?? null,
      enableNoHelmet: updated.enableNoHelmet ?? null,
      enableNoVest: updated.enableNoVest ?? null,
      enableRestrictedArea: updated.enableRestrictedArea ?? null,
      modelVersionId: updated.modelVersionId ?? null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deleteCameraSafetyConfig(
    cameraId: string,
    actorId?: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    const camera = await this.repository.findCameraById(cameraId);
    if (!camera) {
      throw new AppError("Không tìm thấy camera", 404, ERROR_CODE.NOT_FOUND);
    }

    await this.repository.clearCameraSafetyConfig(cameraId);
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
  ): Promise<EffectiveSafetyConfigResultDto> {
    const cached = query.cameraId
      ? this.cache.getForCamera(query.cameraId)
      : query.siteId
        ? this.cache.get(`effective:site:${query.siteId}`)
        : null;

    if (cached) {
      return cached;
    }

    let siteId = query.siteId;
    let camera: any = null;
    let cameraConfig: any = null;
    let isCameraOverride = false;

    if (query.cameraId) {
      camera = await this.repository.findCameraById(query.cameraId);
      if (!camera) {
        throw new AppError("Không tìm thấy camera", 404, ERROR_CODE.NOT_FOUND);
      }
      siteId = camera.siteId;
      cameraConfig = await this.repository.findCameraConfig(query.cameraId);
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

    // Kiểm tra xem camera có trường override nào không
    if (
      cameraConfig &&
      (cameraConfig.confidenceThreshold !== null ||
        cameraConfig.confirmationDuration !== null ||
        cameraConfig.cooldownDuration !== null ||
        cameraConfig.enableNoHelmet !== null ||
        cameraConfig.enableNoVest !== null ||
        cameraConfig.enableRestrictedArea !== null ||
        cameraConfig.modelVersionId !== null)
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
        ? cameraConfig.confirmationDuration
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
      this.repository.findActiveModelVersion(targetModelVersionId),
      this.repository.findRestrictedAreas(siteId, camera?.zoneId),
    ]);

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
      this.cache.clear();
    }
  }
}

export const safetyRuleService = new SafetyRuleService();

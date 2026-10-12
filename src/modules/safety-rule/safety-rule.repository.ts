import { sitePrisma } from "../../database/site.client";
import { cameraPrisma } from "../../database/camera.client";
import { reportingPrisma } from "../../database/reporting.client";
import {
  UpdateSiteSafetyConfigDto,
  UpdateCameraSafetyConfigDto,
  ResolvedAiModelVersionDto,
  ResolvedRestrictedAreaDto,
} from "./safety-rule.dto";
import { DEFAULT_SAFETY_CONFIG } from "./safety-rule.constant";
import {
  AUDIT_TARGET_TYPE,
  AuditAction,
} from "../../common/constants/audit-log.constant";

export interface SafetyAuditLogger {
  createAuditLog(data: any): Promise<any>;
}

export class SafetyRuleRepository {
  private readonly siteDb = sitePrisma;
  private readonly cameraDb = cameraPrisma;
  private readonly reportingDb = reportingPrisma;
  private readonly rbacRepo?: SafetyAuditLogger;

  constructor(rbacRepo?: SafetyAuditLogger) {
    this.rbacRepo = rbacRepo;
  }

  // ── Site & Site Safety Config ──────────────────────────────────────────────
  async findSiteById(siteId: string) {
    return this.siteDb.site.findUnique({
      where: { id: siteId },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
      },
    });
  }

  async findSiteSafetyConfig(siteId: string) {
    return this.siteDb.siteSafetyConfig.findUnique({
      where: { siteId },
    });
  }

  async upsertSiteSafetyConfig(
    siteId: string,
    data: UpdateSiteSafetyConfigDto,
    updatedBy?: string,
  ) {
    return this.siteDb.siteSafetyConfig.upsert({
      where: { siteId },
      update: {
        ...(data.confidenceThreshold !== undefined && {
          confidenceThreshold: data.confidenceThreshold,
        }),
        ...(data.confirmationDuration !== undefined && {
          confirmationDuration: data.confirmationDuration,
        }),
        ...(data.cooldownDuration !== undefined && {
          cooldownDuration: data.cooldownDuration,
        }),
        ...(data.enableNoHelmet !== undefined && {
          enableNoHelmet: data.enableNoHelmet,
        }),
        ...(data.enableNoVest !== undefined && {
          enableNoVest: data.enableNoVest,
        }),
        ...(data.enableRestrictedArea !== undefined && {
          enableRestrictedArea: data.enableRestrictedArea,
        }),
        ...(data.modelVersionId !== undefined && {
          modelVersionId: data.modelVersionId,
        }),
        updatedBy: updatedBy || undefined,
      },
      create: {
        siteId,
        confidenceThreshold:
          data.confidenceThreshold ?? DEFAULT_SAFETY_CONFIG.confidenceThreshold,
        confirmationDuration:
          data.confirmationDuration ??
          DEFAULT_SAFETY_CONFIG.confirmationDuration,
        cooldownDuration:
          data.cooldownDuration ?? DEFAULT_SAFETY_CONFIG.cooldownDuration,
        enableNoHelmet:
          data.enableNoHelmet ?? DEFAULT_SAFETY_CONFIG.enableNoHelmet,
        enableNoVest: data.enableNoVest ?? DEFAULT_SAFETY_CONFIG.enableNoVest,
        enableRestrictedArea:
          data.enableRestrictedArea ??
          DEFAULT_SAFETY_CONFIG.enableRestrictedArea,
        modelVersionId: data.modelVersionId ?? null,
        updatedBy: updatedBy || null,
      },
    });
  }

  // ── Camera & Camera Safety Config Overrides ────────────────────────────────
  async findCameraById(cameraId: string) {
    return this.cameraDb.camera.findUnique({
      where: { id: cameraId },
      select: {
        id: true,
        siteId: true,
        zoneId: true,
        name: true,
        code: true,
        status: true,
      },
    });
  }

  async findCameraConfig(cameraId: string) {
    return this.cameraDb.cameraConfig.findUnique({
      where: { cameraId },
    });
  }

  async upsertCameraSafetyConfig(
    cameraId: string,
    data: UpdateCameraSafetyConfigDto,
  ) {
    const updatePayload: Record<string, unknown> = {};
    if (data.confidenceThreshold !== undefined)
      updatePayload.confidenceThreshold = data.confidenceThreshold;
    if (data.confirmationDuration !== undefined)
      updatePayload.confirmationDuration = data.confirmationDuration;
    if (data.cooldownDuration !== undefined)
      updatePayload.cooldownDuration = data.cooldownDuration;
    if (data.enableNoHelmet !== undefined)
      updatePayload.enableNoHelmet = data.enableNoHelmet;
    if (data.enableNoVest !== undefined)
      updatePayload.enableNoVest = data.enableNoVest;
    if (data.enableRestrictedArea !== undefined)
      updatePayload.enableRestrictedArea = data.enableRestrictedArea;
    if (data.modelVersionId !== undefined)
      updatePayload.modelVersionId = data.modelVersionId;

    return this.cameraDb.cameraConfig.upsert({
      where: { cameraId },
      update: updatePayload,
      create: {
        cameraId,
        enabled: true,
        captureFps: 10,
        resolution: "1920x1080",
        processingEnabled: true,
        ...updatePayload,
      },
    });
  }

  async clearCameraSafetyConfig(cameraId: string) {
    return this.cameraDb.cameraConfig.update({
      where: { cameraId },
      data: {
        confidenceThreshold: null,
        confirmationDuration: null,
        cooldownDuration: null,
        enableNoHelmet: null,
        enableNoVest: null,
        enableRestrictedArea: null,
        modelVersionId: null,
      },
    });
  }

  // ── AI Model Version Governance (Reporting DB) ─────────────────────────────
  async findActiveModelVersion(
    modelVersionId?: string | null,
  ): Promise<ResolvedAiModelVersionDto | null> {
    try {
      if (modelVersionId) {
        const version = await this.reportingDb.aiModelVersion.findUnique({
          where: { id: modelVersionId },
          include: {
            model: {
              select: { name: true, code: true, modelType: true },
            },
          },
        });
        if (version) {
          return {
            id: version.id,
            modelId: version.modelId,
            modelName: version.model?.name || "PPE Detector",
            modelCode: version.model?.code || "YOLO_PPE",
            version: version.version,
            framework: version.framework,
            inputSize: version.inputSize,
            status: version.status,
            metrics: version.metrics,
          };
        }
        return null;
      }

      // Fallback: Tìm bản ghi có status DEPLOYED mới nhất
      const deployed = await this.reportingDb.aiModelVersion.findFirst({
        where: { status: "DEPLOYED" },
        orderBy: { deployedAt: "desc" },
        include: {
          model: {
            select: { name: true, code: true, modelType: true },
          },
        },
      });

      if (!deployed) return null;

      return {
        id: deployed.id,
        modelId: deployed.modelId,
        modelName: deployed.model?.name || "PPE Detector",
        modelCode: deployed.model?.code || "YOLO_PPE",
        version: deployed.version,
        framework: deployed.framework,
        inputSize: deployed.inputSize,
        status: deployed.status,
        metrics: deployed.metrics,
      };
    } catch {
      return null;
    }
  }

  // ── Restricted Areas (Site DB) ─────────────────────────────────────────────
  async findRestrictedAreas(
    siteId: string,
    zoneId?: string | null,
  ): Promise<ResolvedRestrictedAreaDto[]> {
    const where: Record<string, unknown> = {
      siteId,
      status: "ACTIVE",
    };

    if (zoneId) {
      where.OR = [{ zoneId }, { zoneId: null }];
    }

    const areas = await this.siteDb.restrictedArea.findMany({
      where: where as any,
      select: {
        id: true,
        name: true,
        zoneId: true,
        boundary: true,
        status: true,
      },
    });

    return areas;
  }

  // ── Audit Logs ─────────────────────────────────────────────────────────────
  async recordAuditLog(params: {
    actorId?: string;
    action: AuditAction;
    targetId: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }) {
    if (!params.actorId || !this.rbacRepo) return;
    try {
      await this.rbacRepo.createAuditLog({
        actorId: params.actorId,
        action: params.action,
        targetType: AUDIT_TARGET_TYPE.PPE_SAFETY_CONFIG,
        targetId: params.targetId,
        details: params.details,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
    } catch (err: unknown) {
      console.warn(
        "[SafetyRule] Failed to record audit log:",
        (err as Error)?.message || err,
      );
    }
  }
}

export const safetyRuleRepository = new SafetyRuleRepository();

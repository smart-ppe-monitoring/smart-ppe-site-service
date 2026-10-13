import { sitePrisma } from "../../database/site.client";
import {
  UpdateSiteSafetyConfigDto,
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

/**
 * SafetyRuleRepository — Tầng truy cập dữ liệu thuần túy cho Site & Safety Config
 *
 * Tuân thủ Clean Architecture (5 Layers) & Database-per-Service:
 * - Chỉ tương tác trực tiếp với ppe_site_db qua sitePrisma.
 * - KHÔNG chứa logic gọi HTTP fetch hay truy vấn chéo database khác.
 */
export class SafetyRuleRepository {
  private readonly siteDb = sitePrisma;
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

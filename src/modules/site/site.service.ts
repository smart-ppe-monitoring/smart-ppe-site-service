import { SiteRepository, siteRepository } from "./site.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import {
  CreateSiteDto,
  UpdateSiteDto,
  SiteQueryDto,
  CreateZoneDto,
  UpdateZoneDto,
  ZoneQueryDto,
  UpdateSiteSafetyConfigDto,
  CreateRestrictedAreaDto,
  UpdateRestrictedAreaDto,
  RestrictedAreaQueryDto,
} from "./site.dto";
import { DEFAULT_SAFETY_CONFIG } from "../../common/constants/site.constant";
import { ROLES } from "../../common/constants/role.constant";
import { formatPaginationMeta } from "../../common/helpers/pagination.helper";
import {
  AUDIT_ACTION,
  AUDIT_TARGET_TYPE,
} from "../../common/constants/audit-log.constant";
import {
  SafetyRuleCacheService,
  safetyRuleCacheService,
} from "../safety-rule/safety-rule-cache.service";

export interface UserContext {
  id?: string;
  email?: string;
  role?: string;
  roleId?: string;
  siteId?: string | null;
  siteIds?: string[];
  permissions?: string[];
}

export interface SiteAuditLogger {
  recordLog(data: {
    actorId?: string;
    action: string;
    targetType: string;
    targetId: string;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<any>;
}

export class SiteService {
  private readonly repository: SiteRepository;
  private readonly audit?: SiteAuditLogger;
  private readonly cache: SafetyRuleCacheService;

  constructor(
    repository?: SiteRepository,
    audit?: SiteAuditLogger,
    cache?: SafetyRuleCacheService,
  ) {
    this.repository = repository || siteRepository;
    this.audit = audit;
    this.cache = cache || safetyRuleCacheService;
  }

  /**
   * Resolves list of siteIds allowed for caller.
   * Returns null if unrestricted (e.g. Admin or internal caller without user context).
   */
  private getAllowedSiteIds(user?: UserContext): string[] | null {
    if (!user) return null;
    if (user.role === ROLES.ADMIN || user.role === "ADMIN") return null;

    const allowed = new Set<string>();
    if (user.siteId) {
      allowed.add(user.siteId);
    }
    if (Array.isArray(user.siteIds)) {
      for (const sid of user.siteIds) {
        if (sid) allowed.add(sid);
      }
    }
    return Array.from(allowed);
  }

  /**
   * Asserts caller has access to the specified siteId.
   */
  private assertSiteAccess(siteId?: string | null, user?: UserContext): void {
    const allowed = this.getAllowedSiteIds(user);
    if (allowed === null) {
      return;
    }
    if (!siteId || !allowed.includes(siteId)) {
      throw new AppError(
        "Bạn không có quyền truy cập hoặc thực hiện thao tác trên công trường này",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }
  }

  // ── Site Operations ────────────────────────────────────────────────────────
  async createSite(data: CreateSiteDto, actorId?: string, _user?: UserContext) {
    const existing = await this.repository.findSiteByCode(data.code);
    if (existing) {
      throw new AppError(
        `Công trường với mã '${data.code.toUpperCase()}' đã tồn tại trong hệ thống`,
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    const created = await this.repository.createSite(data);

    // Ghi AuditLog tạo mới công trường
    await this.audit?.recordLog({
      actorId,
      action: AUDIT_ACTION.CREATE_PPE_SITE,
      targetType: AUDIT_TARGET_TYPE.PPE_SITE,
      targetId: created.id,
      details: {
        code: created.code,
        name: created.name,
      },
    });

    return created;
  }

  async findSiteById(id: string, user?: UserContext) {
    this.assertSiteAccess(id, user);
    const site = await this.repository.findSiteById(id);
    if (!site) {
      throw new AppError(
        "Không tìm thấy công trường",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }
    return site;
  }

  async findAllSites(query: SiteQueryDto, user?: UserContext) {
    const allowed = this.getAllowedSiteIds(user);
    if (allowed !== null) {
      if (allowed.length === 0) {
        return {
          data: [],
          meta: formatPaginationMeta(
            Number(query.page) || 1,
            Number(query.limit) || 20,
            0,
          ),
        };
      }
      return this.repository.findAllSites({
        ...query,
        siteIds: allowed,
      } as any);
    }
    return this.repository.findAllSites(query);
  }

  async updateSite(id: string, data: UpdateSiteDto, actorId?: string, user?: UserContext) {
    this.assertSiteAccess(id, user);
    await this.findSiteById(id, user);

    if (data.code) {
      const existing = await this.repository.findSiteByCode(data.code);
      if (existing && existing.id !== id) {
        throw new AppError(
          `Mã công trường '${data.code.toUpperCase()}' đã được sử dụng bởi công trường khác`,
          409,
          ERROR_CODE.DUPLICATE_ENTRY,
        );
      }
    }

    const updated = await this.repository.updateSite(id, data);

    // Ghi AuditLog cập nhật công trường
    await this.audit?.recordLog({
      actorId,
      action: AUDIT_ACTION.UPDATE_PPE_SITE,
      targetType: AUDIT_TARGET_TYPE.PPE_SITE,
      targetId: id,
      details: data as Record<string, unknown>,
    });

    return updated;
  }

  async deleteSite(id: string, force = false, actorId?: string, user?: UserContext) {
    this.assertSiteAccess(id, user);
    const site = await this.findSiteById(id, user);

    const hasChildren =
      (site._count?.zones && site._count.zones > 0) ||
      (site._count?.restrictedAreas && site._count.restrictedAreas > 0);

    if (hasChildren && !force) {
      throw new AppError(
        `Không thể xóa công trường đang chứa ${site._count?.zones || 0} phân khu và ${
          site._count?.restrictedAreas || 0
        } vùng hạn chế. Vui lòng chuyển trạng thái sang ARCHIVED hoặc xóa các phân khu trước.`,
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const deleted = await this.repository.deleteSite(id);

    // Ghi AuditLog xóa công trường
    await this.audit?.recordLog({
      actorId,
      action: AUDIT_ACTION.DELETE_PPE_SITE,
      targetType: AUDIT_TARGET_TYPE.PPE_SITE,
      targetId: id,
      details: {
        code: site.code,
        name: site.name,
      },
    });

    return deleted;
  }

  async archiveSite(id: string, user?: UserContext) {
    this.assertSiteAccess(id, user);
    await this.findSiteById(id, user);
    return this.repository.archiveSite(id);
  }

  // ── Zone Operations ────────────────────────────────────────────────────────
  async createZone(data: CreateZoneDto, user?: UserContext) {
    this.assertSiteAccess(data.siteId, user);
    await this.findSiteById(data.siteId, user);

    const existing = await this.repository.findZoneByCode(
      data.siteId,
      data.code,
    );
    if (existing) {
      throw new AppError(
        `Phân khu với mã '${data.code.toUpperCase()}' đã tồn tại trong công trường này`,
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    return this.repository.createZone(data);
  }

  async findZoneById(id: string, user?: UserContext) {
    const zone = await this.repository.findZoneById(id);
    if (!zone) {
      throw new AppError(
        "Không tìm thấy phân khu",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }
    this.assertSiteAccess(zone.siteId, user);
    return zone;
  }

  async findAllZones(query: ZoneQueryDto, user?: UserContext) {
    if (query.siteId) {
      this.assertSiteAccess(query.siteId, user);
      await this.findSiteById(query.siteId, user);
    } else {
      const allowed = this.getAllowedSiteIds(user);
      if (allowed !== null) {
        if (allowed.length === 0) {
          return {
            data: [],
            meta: formatPaginationMeta(
              Number(query.page) || 1,
              Number(query.limit) || 20,
              0,
            ),
          };
        }
        return this.repository.findAllZones({
          ...query,
          siteIds: allowed,
        } as any);
      }
    }
    return this.repository.findAllZones(query);
  }

  async updateZone(id: string, data: UpdateZoneDto, user?: UserContext) {
    const zone = await this.findZoneById(id, user);

    if (data.code) {
      const existing = await this.repository.findZoneByCode(
        zone.siteId,
        data.code,
      );
      if (existing && existing.id !== id) {
        throw new AppError(
          `Mã phân khu '${data.code.toUpperCase()}' đã được sử dụng trong công trường này`,
          409,
          ERROR_CODE.DUPLICATE_ENTRY,
        );
      }
    }

    return this.repository.updateZone(id, data);
  }

  async deleteZone(id: string, user?: UserContext) {
    await this.findZoneById(id, user);
    return this.repository.deleteZone(id);
  }

  // ── Safety Config Operations ───────────────────────────────────────────────
  async getSafetyConfig(siteId: string, user?: UserContext) {
    this.assertSiteAccess(siteId, user);
    await this.findSiteById(siteId, user);

    const config = await this.repository.findSafetyConfigBySiteId(siteId);
    if (!config) {
      // Tự động khởi tạo nếu chưa có
      return this.repository.upsertSafetyConfig(siteId, {
        confidenceThreshold: DEFAULT_SAFETY_CONFIG.confidenceThreshold,
        confirmationDuration: DEFAULT_SAFETY_CONFIG.confirmationDuration,
        cooldownDuration: DEFAULT_SAFETY_CONFIG.cooldownDuration,
        enableNoHelmet: DEFAULT_SAFETY_CONFIG.enableNoHelmet,
        enableNoVest: DEFAULT_SAFETY_CONFIG.enableNoVest,
        enableRestrictedArea: DEFAULT_SAFETY_CONFIG.enableRestrictedArea,
      });
    }

    return config;
  }

  async updateSafetyConfig(
    siteId: string,
    data: UpdateSiteSafetyConfigDto,
    updatedBy?: string,
    user?: UserContext,
  ) {
    this.assertSiteAccess(siteId, user);
    await this.findSiteById(siteId, user);
    const result = await this.repository.upsertSafetyConfig(siteId, data, updatedBy);
    this.cache.invalidateSite(siteId);
    return result;
  }

  // ── Restricted Area Operations ─────────────────────────────────────────────
  async createRestrictedArea(data: CreateRestrictedAreaDto, user?: UserContext) {
    this.assertSiteAccess(data.siteId, user);
    await this.findSiteById(data.siteId, user);

    if (data.zoneId) {
      const zone = await this.findZoneById(data.zoneId, user);
      if (zone.siteId !== data.siteId) {
        throw new AppError(
          "Phân khu được chỉ định không thuộc công trường này",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }
    }

    return this.repository.createRestrictedArea(data);
  }

  async findRestrictedAreaById(id: string, user?: UserContext) {
    const area = await this.repository.findRestrictedAreaById(id);
    if (!area) {
      throw new AppError(
        "Không tìm thấy vùng hạn chế",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }
    this.assertSiteAccess(area.siteId, user);
    return area;
  }

  async findAllRestrictedAreas(
    query: RestrictedAreaQueryDto,
    user?: UserContext,
  ) {
    if (query.siteId) {
      this.assertSiteAccess(query.siteId, user);
      await this.findSiteById(query.siteId, user);
    } else {
      const allowed = this.getAllowedSiteIds(user);
      if (allowed !== null) {
        if (allowed.length === 0) {
          return {
            data: [],
            meta: formatPaginationMeta(
              Number(query.page) || 1,
              Number(query.limit) || 20,
              0,
            ),
          };
        }
        return this.repository.findAllRestrictedAreas({
          ...query,
          siteIds: allowed,
        } as any);
      }
    }
    return this.repository.findAllRestrictedAreas(query);
  }

  async findRestrictedAreasByZone(
    zoneId: string,
    query: RestrictedAreaQueryDto,
    user?: UserContext,
  ) {
    const zone = await this.findZoneById(zoneId, user);
    this.assertSiteAccess(zone.siteId, user);
    return this.repository.findAllRestrictedAreas({
      ...query,
      siteId: zone.siteId,
      zoneId,
    });
  }

  async updateRestrictedArea(id: string, data: UpdateRestrictedAreaDto, user?: UserContext) {
    const area = await this.findRestrictedAreaById(id, user);

    if (data.zoneId) {
      const zone = await this.findZoneById(data.zoneId, user);
      if (zone.siteId !== area.siteId) {
        throw new AppError(
          "Phân khu được chỉ định không thuộc công trường của vùng hạn chế này",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }
    }

    return this.repository.updateRestrictedArea(id, data);
  }

  async deleteRestrictedArea(id: string, user?: UserContext) {
    await this.findRestrictedAreaById(id, user);
    return this.repository.deleteRestrictedArea(id);
  }
}

export const siteService = new SiteService();

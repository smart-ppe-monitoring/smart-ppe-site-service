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

export class SiteService {
  private readonly repository: SiteRepository;

  constructor(repository?: SiteRepository) {
    this.repository = repository || siteRepository;
  }

  // ── Site Operations ────────────────────────────────────────────────────────
  async createSite(data: CreateSiteDto) {
    const existing = await this.repository.findSiteByCode(data.code);
    if (existing) {
      throw new AppError(
        `Công trường với mã '${data.code.toUpperCase()}' đã tồn tại trong hệ thống`,
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }

    return this.repository.createSite(data);
  }

  async findSiteById(id: string) {
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

  async findAllSites(query: SiteQueryDto) {
    return this.repository.findAllSites(query);
  }

  async updateSite(id: string, data: UpdateSiteDto) {
    await this.findSiteById(id);

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

    return this.repository.updateSite(id, data);
  }

  async deleteSite(id: string, force = false) {
    const site = await this.findSiteById(id);

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

    return this.repository.deleteSite(id);
  }

  async archiveSite(id: string) {
    await this.findSiteById(id);
    return this.repository.archiveSite(id);
  }

  // ── Zone Operations ────────────────────────────────────────────────────────
  async createZone(data: CreateZoneDto) {
    await this.findSiteById(data.siteId);

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

  async findZoneById(id: string) {
    const zone = await this.repository.findZoneById(id);
    if (!zone) {
      throw new AppError(
        "Không tìm thấy phân khu",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }
    return zone;
  }

  async findAllZones(query: ZoneQueryDto) {
    if (query.siteId) {
      await this.findSiteById(query.siteId);
    }
    return this.repository.findAllZones(query);
  }

  async updateZone(id: string, data: UpdateZoneDto) {
    const zone = await this.findZoneById(id);

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

  async deleteZone(id: string) {
    await this.findZoneById(id);
    return this.repository.deleteZone(id);
  }

  // ── Safety Config Operations ───────────────────────────────────────────────
  async getSafetyConfig(siteId: string) {
    await this.findSiteById(siteId);

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
  ) {
    await this.findSiteById(siteId);
    return this.repository.upsertSafetyConfig(siteId, data, updatedBy);
  }

  // ── Restricted Area Operations ─────────────────────────────────────────────
  async createRestrictedArea(data: CreateRestrictedAreaDto) {
    await this.findSiteById(data.siteId);

    if (data.zoneId) {
      const zone = await this.findZoneById(data.zoneId);
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

  async findRestrictedAreaById(id: string) {
    const area = await this.repository.findRestrictedAreaById(id);
    if (!area) {
      throw new AppError(
        "Không tìm thấy vùng hạn chế",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }
    return area;
  }

  async findAllRestrictedAreas(query: RestrictedAreaQueryDto) {
    if (query.siteId) {
      await this.findSiteById(query.siteId);
    }
    return this.repository.findAllRestrictedAreas(query);
  }

  async findRestrictedAreasByZone(
    zoneId: string,
    query: RestrictedAreaQueryDto,
  ) {
    const zone = await this.findZoneById(zoneId);
    return this.repository.findAllRestrictedAreas({
      ...query,
      siteId: zone.siteId,
      zoneId,
    });
  }

  async updateRestrictedArea(id: string, data: UpdateRestrictedAreaDto) {
    const area = await this.findRestrictedAreaById(id);

    if (data.zoneId) {
      const zone = await this.findZoneById(data.zoneId);
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

  async deleteRestrictedArea(id: string) {
    await this.findRestrictedAreaById(id);
    return this.repository.deleteRestrictedArea(id);
  }
}

export const siteService = new SiteService();

import {
  sitePrisma,
  DEFAULT_SITE_TRANSACTION_OPTIONS,
} from "../../database/site.client";
import {
  calculatePaginationSkip,
  formatPaginationMeta,
} from "../../common/helpers/pagination.helper";
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
  PaginatedResultDto,
} from "./site.dto";
import {
  SITE_STATUS,
  DEFAULT_SAFETY_CONFIG,
} from "../../common/constants/site.constant";

export class SiteRepository {
  private readonly db: typeof sitePrisma;

  constructor(dbClient?: any) {
    this.db = dbClient || sitePrisma;
  }

  // ── Site Operations ────────────────────────────────────────────────────────
  async createSite(data: CreateSiteDto) {
    const startDate = data.startDate ? new Date(data.startDate) : undefined;
    const endDate = data.endDate ? new Date(data.endDate) : undefined;

    return (this.db as any).$transaction(
      async (tx: any) => {
        const site = await tx.site.create({
          data: {
            name: data.name,
            code: data.code.toUpperCase(),
            address: data.address,
            description: data.description,
            status: data.status || SITE_STATUS.ACTIVE,
            startDate,
            endDate,
          },
        });

        // Tự động khởi tạo SiteSafetyConfig mặc định cho công trường mới
        await tx.siteSafetyConfig.create({
          data: {
            siteId: site.id,
            confidenceThreshold: DEFAULT_SAFETY_CONFIG.confidenceThreshold,
            confirmationDuration: DEFAULT_SAFETY_CONFIG.confirmationDuration,
            cooldownDuration: DEFAULT_SAFETY_CONFIG.cooldownDuration,
            enableNoHelmet: DEFAULT_SAFETY_CONFIG.enableNoHelmet,
            enableNoVest: DEFAULT_SAFETY_CONFIG.enableNoVest,
            enableRestrictedArea: DEFAULT_SAFETY_CONFIG.enableRestrictedArea,
          },
        });

        return tx.site.findUnique({
          where: { id: site.id },
          include: {
            safetyConfigs: true,
            _count: {
              select: {
                zones: true,
                restrictedAreas: true,
              },
            },
          },
        });
      },
      DEFAULT_SITE_TRANSACTION_OPTIONS,
    );
  }

  async findSiteById(id: string) {
    return (this.db as any).site.findUnique({
      where: { id },
      include: {
        safetyConfigs: true,
        zones: {
          orderBy: { code: "asc" },
        },
        _count: {
          select: {
            zones: true,
            restrictedAreas: true,
          },
        },
      },
    });
  }

  async findSiteByCode(code: string) {
    return (this.db as any).site.findUnique({
      where: { code: code.toUpperCase() },
    });
  }

  async findAllSites(query: SiteQueryDto): Promise<PaginatedResultDto<any>> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = calculatePaginationSkip(page, limit);

    const where: any = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } },
      ];
    }

    const orderBy = query.sortBy
      ? { [query.sortBy]: query.sortOrder || "desc" }
      : { createdAt: "desc" };

    const [total, data] = await Promise.all([
      (this.db as any).site.count({ where }),
      (this.db as any).site.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          safetyConfigs: true,
          _count: {
            select: {
              zones: true,
              restrictedAreas: true,
            },
          },
        },
      }),
    ]);

    return {
      data,
      meta: formatPaginationMeta(page, limit, total),
    };
  }

  async updateSite(id: string, data: UpdateSiteDto) {
    const updateData: any = { ...data };
    if (data.code) {
      updateData.code = data.code.toUpperCase();
    }
    if (data.startDate !== undefined) {
      updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    }
    if (data.endDate !== undefined) {
      updateData.endDate = data.endDate ? new Date(data.endDate) : null;
    }

    return (this.db as any).site.update({
      where: { id },
      data: updateData,
      include: {
        safetyConfigs: true,
        _count: {
          select: {
            zones: true,
            restrictedAreas: true,
          },
        },
      },
    });
  }

  async deleteSite(id: string) {
    return (this.db as any).site.delete({
      where: { id },
    });
  }

  async archiveSite(id: string) {
    return (this.db as any).site.update({
      where: { id },
      data: { status: SITE_STATUS.ARCHIVED },
    });
  }

  // ── Zone Operations ────────────────────────────────────────────────────────
  async createZone(data: CreateZoneDto) {
    return (this.db as any).zone.create({
      data: {
        siteId: data.siteId,
        name: data.name,
        code: data.code.toUpperCase(),
        description: data.description,
        status: data.status,
      },
      include: {
        site: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  async findZoneById(id: string) {
    return (this.db as any).zone.findUnique({
      where: { id },
      include: {
        site: {
          select: { id: true, name: true, code: true },
        },
        restrictedAreas: true,
      },
    });
  }

  async findZoneByCode(siteId: string, code: string) {
    return (this.db as any).zone.findUnique({
      where: {
        siteId_code: {
          siteId,
          code: code.toUpperCase(),
        },
      },
    });
  }

  async findAllZones(query: ZoneQueryDto): Promise<PaginatedResultDto<any>> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = calculatePaginationSkip(page, limit);

    const where: any = {};
    if (query.siteId) {
      where.siteId = query.siteId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ];
    }

    const orderBy = query.sortBy
      ? { [query.sortBy]: query.sortOrder || "desc" }
      : { createdAt: "desc" };

    const [total, data] = await Promise.all([
      (this.db as any).zone.count({ where }),
      (this.db as any).zone.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          site: {
            select: { id: true, name: true, code: true },
          },
        },
      }),
    ]);

    return {
      data,
      meta: formatPaginationMeta(page, limit, total),
    };
  }

  async updateZone(id: string, data: UpdateZoneDto) {
    const updateData: any = { ...data };
    if (data.code) {
      updateData.code = data.code.toUpperCase();
    }

    return (this.db as any).zone.update({
      where: { id },
      data: updateData,
      include: {
        site: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  async deleteZone(id: string) {
    return (this.db as any).zone.delete({
      where: { id },
    });
  }

  // ── Safety Config Operations ───────────────────────────────────────────────
  async findSafetyConfigBySiteId(siteId: string) {
    return (this.db as any).siteSafetyConfig.findUnique({
      where: { siteId },
    });
  }

  async upsertSafetyConfig(
    siteId: string,
    data: UpdateSiteSafetyConfigDto,
    updatedBy?: string,
  ) {
    return (this.db as any).siteSafetyConfig.upsert({
      where: { siteId },
      update: {
        ...data,
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
        updatedBy,
      },
    });
  }

  // ── Restricted Area Operations ─────────────────────────────────────────────
  async createRestrictedArea(data: CreateRestrictedAreaDto) {
    return (this.db as any).restrictedArea.create({
      data: {
        siteId: data.siteId,
        zoneId: data.zoneId,
        name: data.name,
        description: data.description,
        boundary: data.boundary as any,
        status: data.status,
      },
      include: {
        site: {
          select: { id: true, name: true, code: true },
        },
        zone: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  async findRestrictedAreaById(id: string) {
    return (this.db as any).restrictedArea.findUnique({
      where: { id },
      include: {
        site: {
          select: { id: true, name: true, code: true },
        },
        zone: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  async findAllRestrictedAreas(
    query: RestrictedAreaQueryDto,
  ): Promise<PaginatedResultDto<any>> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = calculatePaginationSkip(page, limit);

    const where: any = {};
    if (query.siteId) {
      where.siteId = query.siteId;
    }
    if (query.zoneId) {
      where.zoneId = query.zoneId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const orderBy = query.sortBy
      ? { [query.sortBy]: query.sortOrder || "desc" }
      : { createdAt: "desc" };

    const [total, data] = await Promise.all([
      (this.db as any).restrictedArea.count({ where }),
      (this.db as any).restrictedArea.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          site: {
            select: { id: true, name: true, code: true },
          },
          zone: {
            select: { id: true, name: true, code: true },
          },
        },
      }),
    ]);

    return {
      data,
      meta: formatPaginationMeta(page, limit, total),
    };
  }

  async updateRestrictedArea(id: string, data: UpdateRestrictedAreaDto) {
    const updateData: any = { ...data };
    if (data.boundary) {
      updateData.boundary = data.boundary as any;
    }

    return (this.db as any).restrictedArea.update({
      where: { id },
      data: updateData,
      include: {
        site: {
          select: { id: true, name: true, code: true },
        },
        zone: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  async deleteRestrictedArea(id: string) {
    return (this.db as any).restrictedArea.delete({
      where: { id },
    });
  }
}

export const siteRepository = new SiteRepository();

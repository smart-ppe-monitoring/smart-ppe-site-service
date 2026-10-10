import { Request, Response, NextFunction } from "express";
import { SiteService, siteService } from "./site.service";
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

export class SiteController {
  private readonly service: SiteService;

  constructor(service?: SiteService) {
    this.service = service || siteService;
  }

  // ── Site Endpoints ─────────────────────────────────────────────────────────
  createSite = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as CreateSiteDto;
      const result = await this.service.createSite(body);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  findSiteById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const result = await this.service.findSiteById(id);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  findAllSites = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as SiteQueryDto;
      const result = await this.service.findAllSites(query);
      res.json({
        success: true,
        data: result.data || result.items,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  };

  updateSite = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const body = req.body as UpdateSiteDto;
      const result = await this.service.updateSite(id, body);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteSite = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const result = await this.service.deleteSite(id);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // ── Safety Config Endpoints ────────────────────────────────────────────────
  getSafetyConfig = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const result = await this.service.getSafetyConfig(id);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  updateSafetyConfig = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const body = req.body as UpdateSiteSafetyConfigDto;
      const updatedBy = req.user?.id;
      const result = await this.service.updateSafetyConfig(id, body, updatedBy);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // ── Site Nested Resources ──────────────────────────────────────────────────
  getSiteZones = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const query = req.query as unknown as ZoneQueryDto;
      const result = await this.service.findAllZones({
        ...query,
        siteId: id,
      });
      res.json({
        success: true,
        data: result.data || result.items,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  };

  createSiteZone = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const body = req.body as Omit<CreateZoneDto, "siteId">;
      const result = await this.service.createZone({
        ...body,
        siteId: id,
      });
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getSiteRestrictedAreas = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params;
      const query = req.query as unknown as RestrictedAreaQueryDto;
      const result = await this.service.findAllRestrictedAreas({
        ...query,
        siteId: id,
      });
      res.json({
        success: true,
        data: result.data || result.items,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  };

  createSiteRestrictedArea = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params;
      const body = req.body as Omit<CreateRestrictedAreaDto, "siteId">;
      const result = await this.service.createRestrictedArea({
        ...body,
        siteId: id,
      });
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // ── Zone Endpoints ─────────────────────────────────────────────────────────
  createZone = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as CreateZoneDto;
      const result = await this.service.createZone(body);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  findZoneById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const result = await this.service.findZoneById(id);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  findAllZones = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as ZoneQueryDto;
      const result = await this.service.findAllZones(query);
      res.json({
        success: true,
        data: result.data || result.items,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  };

  updateZone = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const body = req.body as UpdateZoneDto;
      const result = await this.service.updateZone(id, body);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteZone = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const result = await this.service.deleteZone(id);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getZoneRestrictedAreas = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params;
      const query = req.query as unknown as RestrictedAreaQueryDto;
      const result = await this.service.findRestrictedAreasByZone(id, query);
      res.json({
        success: true,
        data: result.data || result.items,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  };

  // ── Restricted Area Endpoints ──────────────────────────────────────────────
  createRestrictedArea = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const body = req.body as CreateRestrictedAreaDto;
      const result = await this.service.createRestrictedArea(body);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  findRestrictedAreaById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params;
      const result = await this.service.findRestrictedAreaById(id);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  findAllRestrictedAreas = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const query = req.query as unknown as RestrictedAreaQueryDto;
      const result = await this.service.findAllRestrictedAreas(query);
      res.json({
        success: true,
        data: result.data || result.items,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  };

  updateRestrictedArea = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params;
      const body = req.body as UpdateRestrictedAreaDto;
      const result = await this.service.updateRestrictedArea(id, body);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteRestrictedArea = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params;
      const result = await this.service.deleteRestrictedArea(id);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const siteController = new SiteController();

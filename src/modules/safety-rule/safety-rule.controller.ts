import { Request, Response, NextFunction } from "express";
import {
  SafetyRuleService,
  safetyRuleService,
} from "./safety-rule.service";
import {
  UpdateSiteSafetyConfigDto,
  UpdateCameraSafetyConfigDto,
  EffectiveSafetyConfigQueryDto,
} from "./safety-rule.dto";

export class SafetyRuleController {
  private readonly service: SafetyRuleService;

  constructor(service?: SafetyRuleService) {
    this.service = service || safetyRuleService;
  }

  getSystemDefault = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data = this.service.getSystemDefault();
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  getSiteSafetyConfig = async (
    req: Request<{ siteId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.getSiteSafetyConfig(req.params.siteId);
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  updateSiteSafetyConfig = async (
    req: Request<{ siteId: string }, unknown, UpdateSiteSafetyConfigDto>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const actorId = (req as any).user?.id;
      const data = await this.service.updateSiteSafetyConfig(
        req.params.siteId,
        req.body,
        actorId,
        {
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        },
      );
      res.json({
        success: true,
        message: "Cập nhật cấu hình quy tắc an toàn công trường thành công",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  getCameraSafetyConfig = async (
    req: Request<{ cameraId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.getCameraSafetyConfig(
        req.params.cameraId,
      );
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  updateCameraSafetyConfig = async (
    req: Request<{ cameraId: string }, unknown, UpdateCameraSafetyConfigDto>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const actorId = (req as any).user?.id;
      const data = await this.service.updateCameraSafetyConfig(
        req.params.cameraId,
        req.body,
        actorId,
        {
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        },
      );
      res.json({
        success: true,
        message: "Cập nhật cấu hình quy tắc an toàn camera thành công",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteCameraSafetyConfig = async (
    req: Request<{ cameraId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const actorId = (req as any).user?.id;
      await this.service.deleteCameraSafetyConfig(req.params.cameraId, actorId, {
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json({
        success: true,
        message:
          "Đã xóa cấu hình override của camera, chuyển sang kế thừa từ công trường",
      });
    } catch (error) {
      next(error);
    }
  };

  getEffectiveConfig = async (
    req: Request<unknown, unknown, unknown, EffectiveSafetyConfigQueryDto>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.getEffectiveConfig(req.query);
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  invalidateCache = async (
    req: Request<unknown, unknown, { siteId?: string; cameraId?: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      this.service.clearCache(req.body?.siteId, req.body?.cameraId);
      res.json({
        success: true,
        message: "Đã xóa bộ nhớ đệm cấu hình quy tắc an toàn thành công",
      });
    } catch (error) {
      next(error);
    }
  };
}

export const safetyRuleController = new SafetyRuleController();

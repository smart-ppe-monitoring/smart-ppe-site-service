import { Request, Response, NextFunction } from "express";
import { AppError } from "../common/errors/app-error";
import { ERROR_CODE } from "../common/errors/error-code";
import { ROLES } from "../common/constants/role.constant";
import { PERMISSIONS } from "../common/constants/permission.constant";

export function resolveSatellitePermissions(req: Request): Set<string> {
  if (!req.user) {
    throw new AppError("Unauthorized", 401, ERROR_CODE.UNAUTHORIZED);
  }

  let userPermissions = new Set<string>();

  if (Array.isArray(req.user.permissions) && req.user.permissions.length > 0) {
    userPermissions = new Set(req.user.permissions);
  } else if (req.user.role === ROLES.ADMIN || req.user.role === "ADMIN") {
    userPermissions = new Set(Object.values(PERMISSIONS));
  } else if (req.user.role === ROLES.SAFETY_MANAGER || req.user.role === "SAFETY_MANAGER") {
    userPermissions = new Set([
      PERMISSIONS.PPE_SITE_READ,
      PERMISSIONS.PPE_SITE_MANAGE,
      PERMISSIONS.PPE_ZONE_READ,
      PERMISSIONS.PPE_ZONE_MANAGE,
      PERMISSIONS.PPE_RESTRICTED_AREA_READ,
      PERMISSIONS.PPE_RESTRICTED_AREA_MANAGE,
      PERMISSIONS.PPE_CAMERA_READ,
      PERMISSIONS.PPE_CAMERA_MANAGE,
      PERMISSIONS.PPE_SAFETY_CONFIG_READ,
      PERMISSIONS.PPE_SAFETY_CONFIG_MANAGE,
      PERMISSIONS.PPE_INCIDENT_READ,
      PERMISSIONS.PPE_INCIDENT_REVIEW,
      PERMISSIONS.PPE_INCIDENT_UPDATE,
      PERMISSIONS.PPE_INCIDENT_MANAGE,
      PERMISSIONS.PPE_REPORTING_READ,
      PERMISSIONS.PPE_REPORTING_EXPORT,
      PERMISSIONS.PPE_AI_METRICS_READ,
      PERMISSIONS.PPE_MODEL_READ,
      PERMISSIONS.NOTIFICATION_READ,
      PERMISSIONS.NOTIFICATION_CREATE,
      PERMISSIONS.FILE_READ,
      PERMISSIONS.FILE_UPLOAD,
      PERMISSIONS.FILE_MANAGE,
    ]);
  } else if (req.user.role === ROLES.SAFETY_OFFICER || req.user.role === "SAFETY_OFFICER") {
    userPermissions = new Set([
      PERMISSIONS.PPE_SITE_READ,
      PERMISSIONS.PPE_ZONE_READ,
      PERMISSIONS.PPE_RESTRICTED_AREA_READ,
      PERMISSIONS.PPE_CAMERA_READ,
      PERMISSIONS.PPE_SAFETY_CONFIG_READ,
      PERMISSIONS.PPE_INCIDENT_READ,
      PERMISSIONS.PPE_INCIDENT_REVIEW,
      PERMISSIONS.PPE_INCIDENT_UPDATE,
      PERMISSIONS.PPE_REPORTING_READ,
      PERMISSIONS.NOTIFICATION_READ,
      PERMISSIONS.FILE_READ,
      PERMISSIONS.FILE_UPLOAD,
    ]);
  } else {
    userPermissions = new Set([
      PERMISSIONS.NOTIFICATION_READ,
      PERMISSIONS.FILE_READ,
    ]);
  }

  // If request is authenticated via API Key, intersect role permissions with scoped API Key permissions
  if (req.apiKey) {
    const keyPermsList = Array.isArray(req.apiKey.permissions)
      ? req.apiKey.permissions
      : Array.from(userPermissions);
    const apiKeyPermissions = new Set(keyPermsList);
    const effectivePermissions = new Set<string>();
    for (const perm of userPermissions) {
      if (apiKeyPermissions.has(perm)) {
        effectivePermissions.add(perm);
      }
    }
    userPermissions = effectivePermissions;
  }

  req.user.permissions = Array.from(userPermissions);
  return userPermissions;
}

export function requirePermission(...permissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        return next(new AppError("Unauthorized", 401, ERROR_CODE.UNAUTHORIZED));
      }

      const userPermissions = resolveSatellitePermissions(req);

      if (req.user.role === ROLES.ADMIN || req.user.role === "ADMIN") {
        return next();
      }

      const hasAll = permissions.every((perm) => userPermissions.has(perm));
      if (!hasAll) {
        return next(
          new AppError(
            "Bạn không có quyền thực hiện hành động này",
            403,
            ERROR_CODE.FORBIDDEN,
          ),
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireAnyPermission(...permissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        return next(new AppError("Unauthorized", 401, ERROR_CODE.UNAUTHORIZED));
      }

      const userPermissions = resolveSatellitePermissions(req);

      if (req.user.role === ROLES.ADMIN || req.user.role === "ADMIN") {
        return next();
      }

      const hasAny = permissions.some((perm) => userPermissions.has(perm));
      if (!hasAny) {
        return next(
          new AppError(
            "Bạn không có quyền thực hiện hành động này",
            403,
            ERROR_CODE.FORBIDDEN,
          ),
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

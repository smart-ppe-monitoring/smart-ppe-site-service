import { Request, Response, NextFunction } from "express";
import { AppError } from "../common/errors/app-error";
import { ERROR_CODE } from "../common/errors/error-code";
import { ROLES } from "../common/constants/role.constant";

function resolveSatellitePermissions(req: Request): Set<string> {
  if (!req.user) {
    throw new AppError("Unauthorized", 401, ERROR_CODE.UNAUTHORIZED);
  }

  let userPermissions = Array.isArray(req.user.permissions)
    ? new Set(req.user.permissions)
    : new Set<string>();

  // If request is authenticated via API Key, intersect role permissions with scoped API Key permissions
  if (req.apiKey) {
    const keyPermsList = Array.isArray(req.apiKey.permissions)
      ? req.apiKey.permissions
      : Array.isArray(req.user.permissions)
        ? req.user.permissions
        : [];
    const apiKeyPermissions = new Set(keyPermsList);
    const effectivePermissions = new Set<string>();
    for (const perm of userPermissions) {
      if (apiKeyPermissions.has(perm)) {
        effectivePermissions.add(perm);
      }
    }
    userPermissions = effectivePermissions;
    req.user.permissions = Array.from(effectivePermissions);
  }

  return userPermissions;
}

export function requirePermission(...permissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        return next(new AppError("Unauthorized", 401, ERROR_CODE.UNAUTHORIZED));
      }

      if (req.user.role === ROLES.ADMIN || req.user.role === "ADMIN") {
        return next();
      }

      const userPermissions = resolveSatellitePermissions(req);
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

      if (req.user.role === ROLES.ADMIN || req.user.role === "ADMIN") {
        return next();
      }

      const userPermissions = resolveSatellitePermissions(req);
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

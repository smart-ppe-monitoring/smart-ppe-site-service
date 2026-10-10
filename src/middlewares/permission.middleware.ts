import { Request, Response, NextFunction } from "express";
import { AppError } from "../common/errors/app-error";
import { ERROR_CODE } from "../common/errors/error-code";
import { ROLES } from "../common/constants/role.constant";

export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError("Unauthorized", 401, ERROR_CODE.UNAUTHORIZED));
    }

    if (req.user.role === ROLES.ADMIN) {
      return next();
    }

    const userPermissions = Array.isArray(req.user.permissions)
      ? new Set(req.user.permissions)
      : new Set<string>();

    if (!userPermissions.has(permission)) {
      return next(
        new AppError(
          "Bạn không có quyền thực hiện hành động này",
          403,
          ERROR_CODE.FORBIDDEN,
        ),
      );
    }

    next();
  };
}

export function requireAnyPermission(...permissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError("Unauthorized", 401, ERROR_CODE.UNAUTHORIZED));
    }

    if (req.user.role === ROLES.ADMIN) {
      return next();
    }

    const userPermissions = Array.isArray(req.user.permissions)
      ? new Set(req.user.permissions)
      : new Set<string>();

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
  };
}

import { Request, Response, NextFunction } from "express";

export function maintenanceGuard() {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    next();
  };
}

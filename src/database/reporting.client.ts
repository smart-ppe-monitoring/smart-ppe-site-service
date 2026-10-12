import { PrismaClient as ReportingPrismaClient } from "@prisma/client-reporting";
import { envConfig } from "../config/env.config";

/**
 * Cấu hình timeout mặc định cho interactive transactions của Reporting Service
 */
export const DEFAULT_REPORTING_TRANSACTION_OPTIONS = {
  maxWait: 10000,
  timeout: 15000,
} as const;

let _reportingPrisma: ReportingPrismaClient | null = null;

export function getReportingPrisma(): ReportingPrismaClient {
  if (!_reportingPrisma) {
    _reportingPrisma = new ReportingPrismaClient({
      log:
        envConfig.nodeEnv === "development"
          ? ["query", "error", "warn"]
          : ["error", "warn"],
    });
  }
  return _reportingPrisma;
}

export const reportingPrisma = new Proxy({} as ReportingPrismaClient, {
  get(_target, prop) {
    return (getReportingPrisma() as any)[prop];
  },
});

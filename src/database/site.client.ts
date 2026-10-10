import { PrismaClient as SitePrismaClient } from "@prisma/client-site";
import { envConfig } from "../config/env.config";

/**
 * Cấu hình timeout mặc định cho interactive transactions của Site Service
 */
export const DEFAULT_SITE_TRANSACTION_OPTIONS = {
  maxWait: 10000,
  timeout: 15000,
} as const;

let _sitePrisma: SitePrismaClient | null = null;

export function getSitePrisma(): SitePrismaClient {
  if (!_sitePrisma) {
    _sitePrisma = new SitePrismaClient({
      log:
        envConfig.nodeEnv === "development"
          ? ["query", "error", "warn"]
          : ["error", "warn"],
    });
  }
  return _sitePrisma;
}

export const sitePrisma = new Proxy({} as SitePrismaClient, {
  get(_target, prop) {
    return (getSitePrisma() as any)[prop];
  },
});

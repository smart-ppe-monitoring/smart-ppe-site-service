import { PrismaClient as CameraPrismaClient } from "@prisma/client-camera";
import { envConfig } from "../config/env.config";

/**
 * Cấu hình timeout mặc định cho interactive transactions của Camera Service
 */
export const DEFAULT_CAMERA_TRANSACTION_OPTIONS = {
  maxWait: 10000,
  timeout: 15000,
} as const;

let _cameraPrisma: CameraPrismaClient | null = null;

export function getCameraPrisma(): CameraPrismaClient {
  if (!_cameraPrisma) {
    _cameraPrisma = new CameraPrismaClient({
      log:
        envConfig.nodeEnv === "development"
          ? ["query", "error", "warn"]
          : ["error", "warn"],
    });
  }
  return _cameraPrisma;
}

export const cameraPrisma = new Proxy({} as CameraPrismaClient, {
  get(_target, prop) {
    return (getCameraPrisma() as any)[prop];
  },
});

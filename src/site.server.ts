import "dotenv/config";
import dns from "node:dns";

// Force IPv4-first resolution in Node.js runtime to prevent ENETUNREACH on platforms without IPv6 routing
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  // Graceful fallback if not supported in runtime
}

import siteApp from "./site.app";
import { envConfig } from "./config/env.config";
import { sitePrisma } from "./database/site.client";

const PORT = envConfig.site.port;

/**
 * Site Microservice Process (:8891)
 *
 * Chịu trách nhiệm độc quyền:
 * 1. Phục vụ HTTP API cho Site, Zone, Safety Config và Restricted Areas
 * 2. Tương tác trực tiếp với cơ sở dữ liệu ppe_site_db
 * 3. Hoạt động sau Traefik reverse proxy hoặc Standalone
 */
export const server = siteApp.listen(PORT, () => {
  console.log(
    `[Site Service] Running on http://localhost:${PORT} in ${envConfig.nodeEnv} mode`,
  );
  console.log(
    `[Site Service] ✅ Listening for sites, zones and restricted areas on port ${PORT}`,
  );
});

let isShuttingDown = false;

export async function handleSiteShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(
    `\n[Site Service] Received ${signal}. Starting graceful shutdown...`,
  );

  const forceExitTimer = setTimeout(() => {
    console.error(
      "[Site Service] Graceful shutdown timed out (10s). Forcing termination.",
    );
    process.exit(1);
  }, 10000);
  forceExitTimer.unref();

  try {
    // 1. Close idle HTTP connections
    if (typeof server.closeIdleConnections === "function") {
      server.closeIdleConnections();
    }

    // 2. Stop accepting new HTTP requests
    await new Promise<void>((resolve) => {
      server.close((err) => {
        if (err) {
          console.error("[Site Service] Error closing HTTP server:", err);
        } else {
          console.log("[Site Service] Closed HTTP server successfully.");
        }
        resolve();
      });
    });

    // 3. Disconnect database client
    await sitePrisma.$disconnect().catch((err: any) => {
      console.warn("[Site Service] Error disconnecting sitePrisma:", err.message);
    });
    console.log("[Site Service] Disconnected from site database.");

    clearTimeout(forceExitTimer);
    console.log("[Site Service] Graceful shutdown completed.");
    process.exit(0);
  } catch (error) {
    console.error("[Site Service] Error during graceful shutdown:", error);
    clearTimeout(forceExitTimer);
    process.exit(1);
  }
}

process.on("SIGTERM", () => void handleSiteShutdown("SIGTERM"));
process.on("SIGINT", () => void handleSiteShutdown("SIGINT"));

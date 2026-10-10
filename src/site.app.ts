import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import {
  errorMiddleware,
  notFoundMiddleware,
} from "./middlewares/error.middleware";
import {
  siteRouter,
  zoneRouter,
  restrictedAreaRouter,
} from "./modules/site/site.route";
import { rateLimitMiddleware } from "./middlewares/rate-limit.middleware";
import { requestIdMiddleware } from "./middlewares/request-id.middleware";
import { maintenanceGuard } from "./middlewares/maintenance.middleware";
import { envConfig } from "./config/env.config";

/**
 * Express Application cho Site Management Microservice (:8891)
 *
 * Đảm nhiệm:
 * - REST API cho Site domain (/api/v1/sites/*)
 * - REST API cho Zone domain (/api/v1/zones/*)
 * - REST API cho Restricted Areas (/api/v1/restricted-areas/*)
 * - Quản lý cấu hình an toàn & ngưỡng AI (/api/v1/sites/:id/safety-config)
 * - Health check cho Traefik Reverse Proxy load balancer
 */
const siteApp = express();

siteApp.set("trust proxy", envConfig.trustProxy);

// 1. Distributed Tracing & Security Headers
siteApp.use(requestIdMiddleware);
siteApp.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }),
);

// 2. CORS Handling
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowed = envConfig.cors.allowedOrigins.map((o) =>
      o.replace(/\/+$/, ""),
    );
    if (!origin) {
      callback(null, true);
      return;
    }
    const cleanOrigin = origin.replace(/\/+$/, "");
    if (allowed.includes("*")) {
      if (envConfig.nodeEnv !== "production") {
        callback(null, true);
        return;
      }
      console.error(
        "[CORS] CORS_ALLOWED_ORIGINS=* is not permitted in production.",
      );
      callback(null, false);
      return;
    }
    if (allowed.includes(cleanOrigin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
};
siteApp.use(cors(corsOptions));
siteApp.use(morgan(envConfig.nodeEnv === "production" ? "combined" : "dev"));
siteApp.use(express.json({ limit: "2mb" }));
siteApp.use(express.urlencoded({ extended: true, limit: "2mb" }));
siteApp.use(cookieParser());

// 3. Health check endpoints cho Traefik Gateway & Monitoring
const healthHandler = (_req: express.Request, res: express.Response) => {
  res.status(200).json({
    status: "ok",
    service: "site-service",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
};

siteApp.get("/health", healthHandler);
siteApp.get("/api/v1/sites/health", healthHandler);
siteApp.get("/sites/health", healthHandler);

// 4. Mount Site, Zone & Restricted Area Routes
// Hỗ trợ dual-mount cả prefix /api/v1/sites và /sites khi qua Gateway hoặc gọi trực tiếp
siteApp.use(
  "/api/v1/sites",
  rateLimitMiddleware,
  maintenanceGuard(),
  siteRouter,
);
siteApp.use("/sites", rateLimitMiddleware, maintenanceGuard(), siteRouter);

siteApp.use(
  "/api/v1/zones",
  rateLimitMiddleware,
  maintenanceGuard(),
  zoneRouter,
);
siteApp.use("/zones", rateLimitMiddleware, maintenanceGuard(), zoneRouter);

siteApp.use(
  "/api/v1/restricted-areas",
  rateLimitMiddleware,
  maintenanceGuard(),
  restrictedAreaRouter,
);
siteApp.use(
  "/restricted-areas",
  rateLimitMiddleware,
  maintenanceGuard(),
  restrictedAreaRouter,
);

// 5. Error & 404 Handlers
siteApp.use(notFoundMiddleware);
siteApp.use(errorMiddleware);

export default siteApp;

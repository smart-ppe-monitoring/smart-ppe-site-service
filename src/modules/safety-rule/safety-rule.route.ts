import { Router } from "express";
import { safetyRuleController } from "./safety-rule.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  siteIdParamSchema,
  cameraIdParamSchema,
  updateSiteSafetyConfigSchema,
  updateCameraSafetyConfigSchema,
  effectiveSafetyConfigQuerySchema,
  invalidateCacheSchema,
} from "./safety-rule.validation";
import { PERMISSIONS } from "../../common/constants/permission.constant";

const router = Router();
const controller = safetyRuleController;

// ── 1. System Default ────────────────────────────────────────────────────────
router.get(
  "/system-default",
  authMiddleware,
  requirePermission(PERMISSIONS.PPE_SAFETY_CONFIG_READ),
  controller.getSystemDefault,
);

// ── 2. Effective Configuration Resolution (Dành cho AI Pipeline & UI) ─────────
router.get(
  "/effective",
  authMiddleware,
  requirePermission(PERMISSIONS.PPE_SAFETY_CONFIG_READ),
  validate(effectiveSafetyConfigQuerySchema, "query"),
  controller.getEffectiveConfig,
);

// ── 3. Site Safety Config ────────────────────────────────────────────────────
router.get(
  "/sites/:siteId",
  authMiddleware,
  requirePermission(PERMISSIONS.PPE_SAFETY_CONFIG_READ),
  validate(siteIdParamSchema, "params"),
  controller.getSiteSafetyConfig,
);

router.put(
  "/sites/:siteId",
  authMiddleware,
  requirePermission(PERMISSIONS.PPE_SAFETY_CONFIG_MANAGE),
  validate(siteIdParamSchema, "params"),
  validate(updateSiteSafetyConfigSchema),
  controller.updateSiteSafetyConfig,
);

// ── 4. Camera Safety Config Overrides ────────────────────────────────────────
router.get(
  "/cameras/:cameraId",
  authMiddleware,
  requirePermission(PERMISSIONS.PPE_SAFETY_CONFIG_READ),
  validate(cameraIdParamSchema, "params"),
  controller.getCameraSafetyConfig,
);

router.put(
  "/cameras/:cameraId",
  authMiddleware,
  requirePermission(PERMISSIONS.PPE_SAFETY_CONFIG_MANAGE),
  validate(cameraIdParamSchema, "params"),
  validate(updateCameraSafetyConfigSchema),
  controller.updateCameraSafetyConfig,
);

router.delete(
  "/cameras/:cameraId",
  authMiddleware,
  requirePermission(PERMISSIONS.PPE_SAFETY_CONFIG_MANAGE),
  validate(cameraIdParamSchema, "params"),
  controller.deleteCameraSafetyConfig,
);

// ── 5. Cache Invalidation ────────────────────────────────────────────────────
router.post(
  "/cache/invalidate",
  authMiddleware,
  requirePermission(PERMISSIONS.PPE_SAFETY_CONFIG_MANAGE),
  validate(invalidateCacheSchema),
  controller.invalidateCache,
);

export const safetyRuleRouter = router;
export default router;

-- Migration: 20261101200000_add_contact_officers_and_camera_safety_config
-- Description: Bổ sung contact_person, contact_phone, contact_officers cho sites, chuyển model_version_id sang VARCHAR(100), và tạo bảng camera_safety_configs

-- AlterTable: sites
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "contact_person" VARCHAR(150);
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "contact_phone" VARCHAR(100);
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "contact_officers" JSONB DEFAULT '[]';

-- AlterTable: site_safety_configs (đổi model_version_id từ UUID sang VARCHAR(100))
ALTER TABLE "site_safety_configs" ALTER COLUMN "model_version_id" TYPE VARCHAR(100) USING model_version_id::varchar;

-- CreateTable: camera_safety_configs
CREATE TABLE IF NOT EXISTS "camera_safety_configs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "camera_id" UUID NOT NULL,
    "confidence_threshold" DECIMAL(5,4),
    "confirmation_duration" DOUBLE PRECISION,
    "cooldown_duration" INTEGER,
    "enable_no_helmet" BOOLEAN,
    "enable_no_vest" BOOLEAN,
    "enable_restricted_area" BOOLEAN,
    "model_version_id" VARCHAR(100),
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "camera_safety_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "camera_safety_configs_camera_id_key" ON "camera_safety_configs"("camera_id");


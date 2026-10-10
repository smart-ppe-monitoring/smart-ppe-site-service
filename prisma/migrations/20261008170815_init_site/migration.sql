-- CreateTable
CREATE TABLE "sites" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "name" VARCHAR(150) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "address" TEXT,
    "description" TEXT,
    "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "start_date" DATE,
    "end_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zones" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "site_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_safety_configs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "site_id" UUID NOT NULL,
    "confidence_threshold" DECIMAL(5,4) NOT NULL DEFAULT 0.80,
    "confirmation_duration" INTEGER NOT NULL DEFAULT 2,
    "cooldown_duration" INTEGER NOT NULL DEFAULT 30,
    "enable_no_helmet" BOOLEAN NOT NULL DEFAULT true,
    "enable_no_vest" BOOLEAN NOT NULL DEFAULT true,
    "enable_restricted_area" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_safety_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restricted_areas" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "site_id" UUID NOT NULL,
    "zone_id" UUID,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "boundary" JSONB NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restricted_areas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sites_code_key" ON "sites"("code");

-- CreateIndex
CREATE INDEX "sites_status_idx" ON "sites"("status");

-- CreateIndex
CREATE INDEX "zones_site_id_status_idx" ON "zones"("site_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "zones_site_id_code_key" ON "zones"("site_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "site_safety_configs_site_id_key" ON "site_safety_configs"("site_id");

-- CreateIndex
CREATE INDEX "restricted_areas_site_id_status_idx" ON "restricted_areas"("site_id", "status");

-- AddForeignKey
ALTER TABLE "zones" ADD CONSTRAINT "zones_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_safety_configs" ADD CONSTRAINT "site_safety_configs_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restricted_areas" ADD CONSTRAINT "restricted_areas_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restricted_areas" ADD CONSTRAINT "restricted_areas_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

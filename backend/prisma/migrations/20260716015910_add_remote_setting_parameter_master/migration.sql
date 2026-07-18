-- CreateTable
-- NOTE: this table already existed in the database (created externally as
-- part of a register-mapping exercise, seeded with 57 rows) before being
-- brought under Prisma's schema/migration tracking. This migration file
-- documents that structure for fresh-database setups; on databases where
-- the table already exists, it is resolved as already-applied instead of
-- being executed (see `prisma migrate resolve --applied`).
CREATE TABLE "remote_setting_parameter_master" (
    "id" BIGSERIAL NOT NULL,
    "tab" VARCHAR(40) NOT NULL,
    "tab_label" VARCHAR(60) NOT NULL,
    "field_key" VARCHAR(60) NOT NULL,
    "label" VARCHAR(150) NOT NULL,
    "data_type" VARCHAR(20) NOT NULL,
    "unit_or_options" VARCHAR(200),
    "endpoint_path" VARCHAR(120) NOT NULL,
    "display_order" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "register_address" VARCHAR(20),
    "register_type" VARCHAR(20),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "remote_setting_parameter_master_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "remote_setting_parameter_master_tab_idx" ON "remote_setting_parameter_master"("tab");

-- CreateIndex
CREATE UNIQUE INDEX "remote_setting_parameter_master_tab_field_key_key" ON "remote_setting_parameter_master"("tab", "field_key");

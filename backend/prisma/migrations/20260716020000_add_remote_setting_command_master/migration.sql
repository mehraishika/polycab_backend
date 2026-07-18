-- CreateTable
-- NOTE: this table already existed in the database (created externally,
-- seeded with the 4 command actions: afdReset, syncDateTime, reset,
-- clearAllData) before being brought under Prisma's schema/migration
-- tracking. This migration file documents that structure for fresh-database
-- setups; on databases where the table already exists, it is resolved as
-- already-applied instead of being executed (see `prisma migrate resolve --applied`).
CREATE TABLE "remote_setting_command_master" (
    "id" BIGSERIAL NOT NULL,
    "command_key" VARCHAR(60) NOT NULL,
    "label" VARCHAR(150) NOT NULL,
    "endpoint_path" VARCHAR(120) NOT NULL DEFAULT '/remote-settings/command',
    "display_order" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "register_address" VARCHAR(20),
    "register_type" VARCHAR(20) DEFAULT 'coil',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "remote_setting_command_master_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "remote_setting_command_master_command_key_key" ON "remote_setting_command_master"("command_key");

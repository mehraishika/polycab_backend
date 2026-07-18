-- CreateEnum
CREATE TYPE "RemoteSettingsTab" AS ENUM ('gridParameters', 'featureParameters', 'reactivePowerControl', 'powerLimit', 'otherSetting', 'maskingFaultDetection');

-- CreateEnum
CREATE TYPE "RemoteSettingsTaskKind" AS ENUM ('settings', 'command');

-- CreateEnum
CREATE TYPE "RemoteSettingsTaskStatus" AS ENUM ('pending', 'completed', 'failed');

-- CreateTable
CREATE TABLE "device_remote_settings" (
    "id" BIGSERIAL NOT NULL,
    "device_inverter_id" BIGINT NOT NULL,
    "tab" "RemoteSettingsTab" NOT NULL,
    "settings" JSONB NOT NULL,
    "updated_by_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_remote_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_remote_setting_tasks" (
    "id" BIGSERIAL NOT NULL,
    "device_inverter_id" BIGINT NOT NULL,
    "kind" "RemoteSettingsTaskKind" NOT NULL,
    "tab" "RemoteSettingsTab",
    "payload" JSONB NOT NULL,
    "status" "RemoteSettingsTaskStatus" NOT NULL DEFAULT 'pending',
    "created_by_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_remote_setting_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "device_remote_settings_device_inverter_id_idx" ON "device_remote_settings"("device_inverter_id");

-- CreateIndex
CREATE UNIQUE INDEX "device_remote_settings_device_inverter_id_tab_key" ON "device_remote_settings"("device_inverter_id", "tab");

-- CreateIndex
CREATE INDEX "device_remote_setting_tasks_device_inverter_id_idx" ON "device_remote_setting_tasks"("device_inverter_id");

-- CreateIndex
CREATE INDEX "device_remote_setting_tasks_status_idx" ON "device_remote_setting_tasks"("status");

-- AddForeignKey
ALTER TABLE "device_remote_settings" ADD CONSTRAINT "device_remote_settings_device_inverter_id_fkey" FOREIGN KEY ("device_inverter_id") REFERENCES "device_inverters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_remote_setting_tasks" ADD CONSTRAINT "device_remote_setting_tasks_device_inverter_id_fkey" FOREIGN KEY ("device_inverter_id") REFERENCES "device_inverters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

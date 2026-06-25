-- CreateEnum
CREATE TYPE "UserPortal" AS ENUM ('monitoring', 'service');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('monitoring_user', 'service_admin', 'service_super_admin');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'disabled', 'pending_verification');

-- CreateEnum
CREATE TYPE "PlantStatus" AS ENUM ('Offline', 'Online', 'Abnormal', 'Standby');

-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "account" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT NOT NULL,
    "portal" "UserPortal" NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "assignedById" BIGINT,
    "timezone" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "email_verified_at" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plants" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "installed" TIMESTAMP(3),
    "last_updated_at" TIMESTAMP(3),
    "kwp" DOUBLE PRECISION,
    "price" DOUBLE PRECISION,
    "price_unit" TEXT,
    "longitude" TEXT,
    "latitude" TEXT,
    "address" TEXT,
    "picture_file_id" TEXT,
    "user_account" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "plants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_inverters" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT,
    "type" TEXT NOT NULL DEFAULT 'inverter',
    "serial_number" TEXT NOT NULL,
    "update_time" TIMESTAMP(3),
    "plant_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "device_inverters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_plant_inverter_map" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "plant_id" BIGINT NOT NULL,
    "inverter_no" TEXT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_plant_inverter_map_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_invertor_status" (
    "id" BIGSERIAL NOT NULL,
    "device_sno" TEXT NOT NULL,
    "latest_time_state" TIMESTAMP(3) NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_invertor_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_dataloggers" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT,
    "type" TEXT NOT NULL DEFAULT 'datalogger',
    "serial_number" TEXT NOT NULL,
    "online" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT,
    "update_time" TIMESTAMP(3),
    "plant_id" BIGINT NOT NULL,
    "inverter_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "device_dataloggers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_logs" (
    "id" BIGSERIAL NOT NULL,
    "sno" VARCHAR(255),
    "logger_status" VARCHAR(255),
    "connected_plant" VARCHAR(255),
    "module_version_no" VARCHAR(255),
    "extended_system_version" VARCHAR(255),
    "data_acquisition_period" TIMESTAMP(3),
    "max_connected_devices" INTEGER,
    "signal_strength" BIGINT,
    "module_mac_address" VARCHAR(255),
    "router_ssid" VARCHAR(255),
    "inverter_type" INTEGER,
    "production_compliance_country" INTEGER,
    "device_model" TEXT,
    "firmware_version" TEXT,
    "production_type" INTEGER,
    "rated_power" INTEGER,
    "phases" INTEGER,
    "mppt_no" INTEGER,
    "inverter_parameter_count" INTEGER,
    "logger_parameter_count" INTEGER,
    "protocol_version" INTEGER,
    "comm_software_version_1" INTEGER,
    "comm_software_version_2" INTEGER,
    "control_software_version" INTEGER,
    "dc_voltage_1" INTEGER,
    "dc_voltage_2" INTEGER,
    "dc_voltage_3" INTEGER,
    "dc_voltage_4" INTEGER,
    "dc_voltage_5" INTEGER,
    "dc_voltage_6" INTEGER,
    "dc_voltage_7" INTEGER,
    "dc_voltage_8" INTEGER,
    "dc_voltage_9" INTEGER,
    "dc_current_1" INTEGER,
    "dc_current_2" INTEGER,
    "dc_current_3" INTEGER,
    "dc_current_4" INTEGER,
    "dc_current_5" INTEGER,
    "dc_current_6" INTEGER,
    "dc_current_7" INTEGER,
    "dc_current_8" INTEGER,
    "dc_current_9" INTEGER,
    "dc_power_1" BIGINT,
    "dc_power_2" BIGINT,
    "dc_power_3" BIGINT,
    "dc_power_4" BIGINT,
    "dc_power_5" BIGINT,
    "dc_power_6" BIGINT,
    "dc_power_7" BIGINT,
    "dc_power_8" BIGINT,
    "dc_power_9" BIGINT,
    "total_input_power" BIGINT,
    "grid_total_active_power" BIGINT,
    "grid_total_reactive_power" BIGINT,
    "fault_registers" INTEGER,
    "fault_1" INTEGER,
    "fault_2" INTEGER,
    "fault_3" INTEGER,
    "fault_4" INTEGER,
    "fault_5" INTEGER,
    "ac_voltage_a" INTEGER,
    "ac_voltage_b" INTEGER,
    "ac_voltage_c" INTEGER,
    "ac_current_a" INTEGER,
    "ac_current_b" INTEGER,
    "ac_current_c" INTEGER,
    "ac_power_a" BIGINT,
    "ac_power_b" BIGINT,
    "ac_power_c" BIGINT,
    "daily_production" INTEGER,
    "grid_status" INTEGER,
    "inverter_status" INTEGER,
    "ac_output_frequency" INTEGER,
    "temperature_count" INTEGER,
    "temperature_1" INTEGER,
    "temperature_2" INTEGER,
    "temperature_3" INTEGER,
    "total_production" INTEGER,
    "total_generation_time" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "mac_address" VARCHAR(255),
    "message_type" INTEGER,
    "hybrid_json" JSONB,

    CONSTRAINT "device_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_logs_latest" (
    "id" BIGSERIAL NOT NULL,
    "sno" VARCHAR(255) NOT NULL,
    "inverter_name" VARCHAR(255) NULL,
    "day_date" DATE NOT NULL,
    "latest_timestamp" TIMESTAMP(3) NOT NULL,
    "source_log_id" BIGINT NOT NULL,
    "batch_key" TEXT NOT NULL,
    "daily_production" INTEGER,
    "total_energy" INTEGER,
    "total_hours" INTEGER,
    "current_power" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_logs_latest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_daily_summary" (
    "id" BIGSERIAL NOT NULL,
    "sno" VARCHAR(255) NOT NULL,
    "day_date" DATE NOT NULL,
    "current_power" INTEGER,
    "e_today" INTEGER,
    "e_total" INTEGER,
    "h_total" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_daily_summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_daily_summary_per_line_chart" (
    "id" BIGSERIAL NOT NULL,
    "sno" VARCHAR(255) NOT NULL,
    "day_date" DATE NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "source_log_id" BIGINT NOT NULL,
    "line_window_minutes" INTEGER NOT NULL DEFAULT 5,
    "max_points" INTEGER NOT NULL DEFAULT 20,
    "logger_status" VARCHAR(255),
    "connected_plant" VARCHAR(255),
    "module_version_no" VARCHAR(255),
    "extended_system_version" VARCHAR(255),
    "data_acquisition_period" TIMESTAMP(3),
    "max_connected_devices" INTEGER,
    "signal_strength" INTEGER,
    "module_mac_address" VARCHAR(255),
    "router_ssid" VARCHAR(255),
    "inverter_type" INTEGER,
    "production_compliance_country" INTEGER,
    "rated_power" INTEGER,
    "mppt_no" INTEGER,
    "protocol_version" INTEGER,
    "comm_software_version_1" INTEGER,
    "comm_software_version_2" INTEGER,
    "control_software_version" INTEGER,
    "device_model" TEXT,
    "firmware_version" TEXT,
    "production_type" INTEGER,
    "dc_voltage_1" INTEGER,
    "dc_voltage_2" INTEGER,
    "dc_voltage_3" INTEGER,
    "dc_voltage_4" INTEGER,
    "dc_voltage_5" INTEGER,
    "dc_voltage_6" INTEGER,
    "dc_voltage_7" INTEGER,
    "dc_voltage_8" INTEGER,
    "dc_current_1" INTEGER,
    "dc_current_2" INTEGER,
    "dc_current_3" INTEGER,
    "dc_current_4" INTEGER,
    "dc_current_5" INTEGER,
    "dc_current_6" INTEGER,
    "dc_current_7" INTEGER,
    "dc_current_8" INTEGER,
    "dc_power_1" INTEGER,
    "dc_power_2" INTEGER,
    "dc_power_3" INTEGER,
    "dc_power_4" INTEGER,
    "dc_power_5" INTEGER,
    "dc_power_6" INTEGER,
    "dc_power_7" INTEGER,
    "dc_power_8" INTEGER,
    "ac_voltage_a" INTEGER,
    "ac_voltage_b" INTEGER,
    "ac_voltage_c" INTEGER,
    "ac_current_a" INTEGER,
    "ac_current_b" INTEGER,
    "ac_current_c" INTEGER,
    "ac_power_a" INTEGER,
    "ac_power_b" INTEGER,
    "ac_power_c" INTEGER,
    "fault_1" INTEGER,
    "fault_2" INTEGER,
    "fault_3" INTEGER,
    "fault_4" INTEGER,
    "fault_5" INTEGER,
    "total_input_power" INTEGER,
    "grid_total_active_power" INTEGER,
    "grid_total_reactive_power" INTEGER,
    "daily_production" INTEGER,
    "grid_status" INTEGER,
    "inverter_status" INTEGER,
    "ac_output_frequency" INTEGER,
    "temperature_1" INTEGER,
    "temperature_2" INTEGER,
    "temperature_3" INTEGER,
    "total_production" INTEGER,
    "total_generation_time" INTEGER,
    "mac_address" VARCHAR(255),
    "message_type" INTEGER,
    "hybrid_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_daily_summary_per_line_chart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "information_data" (
    "id" BIGSERIAL NOT NULL,
    "Input Power" DOUBLE PRECISION,
    "co2" DOUBLE PRECISION,
    "Tree Planting" DOUBLE PRECISION,
    "efficiency" DOUBLE PRECISION,
    "weather" TEXT,
    "irradiance" DOUBLE PRECISION,
    "cell_temperature" DOUBLE PRECISION,
    "plantid" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "information_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_account_key" ON "users"("account");

-- CreateIndex
CREATE INDEX "users_portal_role_idx" ON "users"("portal", "role");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_assignedById_idx" ON "users"("assignedById");

-- CreateIndex
CREATE UNIQUE INDEX "users_portal_email_key" ON "users"("portal", "email");

-- CreateIndex
CREATE INDEX "plants_type_idx" ON "plants"("type");

-- CreateIndex
CREATE INDEX "plants_name_idx" ON "plants"("name");

-- CreateIndex
CREATE INDEX "plants_user_account_idx" ON "plants"("user_account");

-- CreateIndex
CREATE INDEX "plants_deleted_at_idx" ON "plants"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "device_inverters_serial_number_key" ON "device_inverters"("serial_number");

-- CreateIndex
CREATE INDEX "device_inverters_plant_id_idx" ON "device_inverters"("plant_id");

-- CreateIndex
CREATE INDEX "device_inverters_serial_number_idx" ON "device_inverters"("serial_number");

-- CreateIndex
CREATE INDEX "device_inverters_type_idx" ON "device_inverters"("type");

-- CreateIndex
CREATE INDEX "device_inverters_deleted_at_idx" ON "device_inverters"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_plant_inverter_map_inverter_no_key" ON "user_plant_inverter_map"("inverter_no");

-- CreateIndex
CREATE INDEX "user_plant_inverter_map_user_id_is_deleted_idx" ON "user_plant_inverter_map"("user_id", "is_deleted");

-- CreateIndex
CREATE INDEX "user_plant_inverter_map_plant_id_is_deleted_idx" ON "user_plant_inverter_map"("plant_id", "is_deleted");

-- CreateIndex
CREATE INDEX "user_plant_inverter_map_inverter_no_idx" ON "user_plant_inverter_map"("inverter_no");

-- CreateIndex
CREATE INDEX "user_plant_inverter_map_inverter_no_is_deleted_idx" ON "user_plant_inverter_map"("inverter_no", "is_deleted");

-- CreateIndex
CREATE INDEX "user_plant_inverter_map_deleted_at_idx" ON "user_plant_inverter_map"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_plant_inverter_map_user_id_plant_id_inverter_no_is_del_key" ON "user_plant_inverter_map"("user_id", "plant_id", "inverter_no", "is_deleted");

-- CreateIndex
CREATE UNIQUE INDEX "device_invertor_status_device_sno_key" ON "device_invertor_status"("device_sno");

-- CreateIndex
CREATE INDEX "device_invertor_status_status_idx" ON "device_invertor_status"("status");

-- CreateIndex
CREATE INDEX "device_invertor_status_latest_time_state_idx" ON "device_invertor_status"("latest_time_state");

-- CreateIndex
CREATE INDEX "device_invertor_status_device_sno_status_idx" ON "device_invertor_status"("device_sno", "status");

-- CreateIndex
CREATE UNIQUE INDEX "device_dataloggers_serial_number_key" ON "device_dataloggers"("serial_number");

-- CreateIndex
CREATE INDEX "device_dataloggers_plant_id_idx" ON "device_dataloggers"("plant_id");

-- CreateIndex
CREATE INDEX "device_dataloggers_inverter_id_idx" ON "device_dataloggers"("inverter_id");

-- CreateIndex
CREATE INDEX "device_dataloggers_serial_number_idx" ON "device_dataloggers"("serial_number");

-- CreateIndex
CREATE INDEX "device_dataloggers_online_idx" ON "device_dataloggers"("online");

-- CreateIndex
CREATE INDEX "device_dataloggers_deleted_at_idx" ON "device_dataloggers"("deleted_at");

-- CreateIndex
CREATE INDEX "device_logs_timestamp_idx" ON "device_logs"("timestamp");

-- CreateIndex
CREATE INDEX "device_logs_sno_idx" ON "device_logs"("sno");

-- CreateIndex
CREATE INDEX "device_logs_sno_timestamp_idx" ON "device_logs"("sno", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "device_logs_latest_source_log_id_key" ON "device_logs_latest"("source_log_id");

-- CreateIndex
CREATE UNIQUE INDEX "device_logs_latest_batch_key_key" ON "device_logs_latest"("batch_key");

-- CreateIndex
CREATE INDEX "device_logs_latest_day_date_idx" ON "device_logs_latest"("day_date");

-- CreateIndex
CREATE INDEX "device_logs_latest_sno_day_date_idx" ON "device_logs_latest"("sno", "day_date");

-- CreateIndex
CREATE INDEX "device_logs_latest_batch_key_idx" ON "device_logs_latest"("batch_key");

-- CreateIndex
CREATE UNIQUE INDEX "device_logs_latest_sno_day_date_key" ON "device_logs_latest"("sno", "day_date");

-- CreateIndex
CREATE INDEX "device_daily_summary_day_date_idx" ON "device_daily_summary"("day_date");

-- CreateIndex
CREATE INDEX "device_daily_summary_sno_day_date_idx" ON "device_daily_summary"("sno", "day_date");

-- CreateIndex
CREATE UNIQUE INDEX "device_daily_summary_sno_day_date_key" ON "device_daily_summary"("sno", "day_date");

-- CreateIndex
CREATE UNIQUE INDEX "device_daily_summary_per_line_chart_source_log_id_key" ON "device_daily_summary_per_line_chart"("source_log_id");

-- CreateIndex
CREATE INDEX "device_daily_summary_per_line_chart_day_date_idx" ON "device_daily_summary_per_line_chart"("day_date");

-- CreateIndex
CREATE INDEX "device_daily_summary_per_line_chart_sno_timestamp_idx" ON "device_daily_summary_per_line_chart"("sno", "timestamp");

-- CreateIndex
CREATE INDEX "device_daily_summary_per_line_chart_sno_day_date_idx" ON "device_daily_summary_per_line_chart"("sno", "day_date");

-- CreateIndex
CREATE UNIQUE INDEX "device_daily_summary_per_line_chart_sno_day_date_timestamp_key" ON "device_daily_summary_per_line_chart"("sno", "day_date", "timestamp");

-- CreateIndex
CREATE INDEX "information_data_plantid_idx" ON "information_data"("plantid");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plants" ADD CONSTRAINT "plants_user_account_fkey" FOREIGN KEY ("user_account") REFERENCES "users"("account") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_inverters" ADD CONSTRAINT "device_inverters_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_plant_inverter_map" ADD CONSTRAINT "user_plant_inverter_map_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_plant_inverter_map" ADD CONSTRAINT "user_plant_inverter_map_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_plant_inverter_map" ADD CONSTRAINT "user_plant_inverter_map_inverter_no_fkey" FOREIGN KEY ("inverter_no") REFERENCES "device_inverters"("serial_number") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_invertor_status" ADD CONSTRAINT "device_invertor_status_device_sno_user_plant_inverter_map_fkey" FOREIGN KEY ("device_sno") REFERENCES "user_plant_inverter_map"("inverter_no") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_dataloggers" ADD CONSTRAINT "device_dataloggers_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_dataloggers" ADD CONSTRAINT "device_dataloggers_inverter_id_fkey" FOREIGN KEY ("inverter_id") REFERENCES "device_inverters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_logs_latest" ADD CONSTRAINT "device_logs_latest_source_log_id_fkey" FOREIGN KEY ("source_log_id") REFERENCES "device_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_daily_summary" ADD CONSTRAINT "device_daily_summary_sno_fkey" FOREIGN KEY ("sno") REFERENCES "user_plant_inverter_map"("inverter_no") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_daily_summary_per_line_chart" ADD CONSTRAINT "device_daily_summary_per_line_chart_source_log_id_fkey" FOREIGN KEY ("source_log_id") REFERENCES "device_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_daily_summary_per_line_chart" ADD CONSTRAINT "device_daily_summary_per_line_chart_sno_fkey" FOREIGN KEY ("sno") REFERENCES "user_plant_inverter_map"("inverter_no") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "information_data" ADD CONSTRAINT "information_data_plantid_fkey" FOREIGN KEY ("plantid") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

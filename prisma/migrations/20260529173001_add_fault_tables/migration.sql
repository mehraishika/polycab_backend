-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM (
    'ACTIVE',
    'CLEARED'
);

-- =====================================================
-- Table: device_alert_state
-- =====================================================

CREATE TABLE "device_alert_state" (
    "id" BIGSERIAL PRIMARY KEY,
    "serial_number" TEXT NOT NULL,
    "plant_id" BIGINT,
    "alert_matrix" JSONB NOT NULL,
    "active_alert_count" INTEGER NOT NULL DEFAULT 0,
    "last_telemetry_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_alert_state_serial_number_key"
        UNIQUE ("serial_number"),

    CONSTRAINT "device_alert_state_plant_id_fkey"
        FOREIGN KEY ("plant_id")
        REFERENCES "plants" ("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE INDEX "device_alert_state_serial_number_idx"
    ON "device_alert_state" ("serial_number");

CREATE INDEX "device_alert_state_plant_id_idx"
    ON "device_alert_state" ("plant_id");


-- =====================================================
-- Table: alert_events
-- =====================================================

CREATE TABLE "alert_events" (
    "id" BIGSERIAL PRIMARY KEY,
    "serial_number" TEXT NOT NULL,
    "plant_id" BIGINT,
    "register_no" INTEGER NOT NULL,
    "bit_position" INTEGER NOT NULL,
    "fault_code" TEXT NOT NULL,
    "fault_message" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL,
    "raised_at" TIMESTAMP(3),
    "cleared_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_events_plant_id_fkey"
        FOREIGN KEY ("plant_id")
        REFERENCES "plants" ("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE INDEX "alert_events_serial_number_idx"
    ON "alert_events" ("serial_number");

CREATE INDEX "alert_events_plant_id_idx"
    ON "alert_events" ("plant_id");

CREATE INDEX "alert_events_status_idx"
    ON "alert_events" ("status");


-- =====================================================
-- Table: fault_dictionary
-- =====================================================

CREATE TABLE "fault_dictionary" (
    "id" BIGSERIAL PRIMARY KEY,
    "register_name" TEXT NOT NULL,
    "register_addr" TEXT NOT NULL,
    "register_no" INTEGER NOT NULL,
    "bit_position" INTEGER NOT NULL,
    "fault_code" TEXT NOT NULL,
    "fault_message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fault_dictionary_register_no_bit_position_key"
        UNIQUE ("register_no", "bit_position")
);
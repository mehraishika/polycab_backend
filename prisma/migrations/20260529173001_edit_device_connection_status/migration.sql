-- ============================================
-- DEVICE CURRENT STATUS
-- ============================================

CREATE TABLE "device_current_status" (
    "id" BIGSERIAL NOT NULL,
    "sno" VARCHAR(255) NOT NULL,
    "status" "PlantStatus" NOT NULL DEFAULT 'Offline',
    "last_telemetry_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_current_status_pkey"
        PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "device_current_status_sno_key"
ON "device_current_status"("sno");

CREATE INDEX "idx_device_current_status_status"
ON "device_current_status"("status");

CREATE INDEX "idx_device_current_status_last_telemetry"
ON "device_current_status"("last_telemetry_at");


-- ============================================
-- DEVICE STATUS HISTORY
-- ============================================

CREATE TABLE "device_status_history" (
    "id" BIGSERIAL NOT NULL,
    "sno" VARCHAR(255) NOT NULL,
    "plant_id" BIGINT,
    "status" "PlantStatus" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_status_history_pkey"
        PRIMARY KEY ("id"),

    CONSTRAINT "device_status_history_plant_id_fkey"
        FOREIGN KEY ("plant_id")
        REFERENCES "plants"("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE INDEX "idx_device_status_history_sno"
ON "device_status_history"("sno");

CREATE INDEX "idx_device_status_history_plant_id"
ON "device_status_history"("plant_id");

CREATE INDEX "idx_device_status_history_status"
ON "device_status_history"("status");

CREATE INDEX "idx_device_status_history_created_at"
ON "device_status_history"("created_at");


-- ============================================
-- PLANT CURRENT STATUS
-- ============================================

CREATE TABLE "plant_current_status" (
    "id" BIGSERIAL NOT NULL,
    "plant_id" BIGINT NOT NULL,
    "status" "PlantStatus" NOT NULL DEFAULT 'Offline',

    "total_devices" INTEGER NOT NULL DEFAULT 0,
    "normal_count" INTEGER NOT NULL DEFAULT 0,
    "abnormal_count" INTEGER NOT NULL DEFAULT 0,
    "standby_count" INTEGER NOT NULL DEFAULT 0,
    "offline_count" INTEGER NOT NULL DEFAULT 0,

    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plant_current_status_pkey"
        PRIMARY KEY ("id"),

    CONSTRAINT "plant_current_status_plant_id_fkey"
        FOREIGN KEY ("plant_id")
        REFERENCES "plants"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "plant_current_status_plant_id_key"
ON "plant_current_status"("plant_id");

CREATE INDEX "idx_plant_current_status_status"
ON "plant_current_status"("status");
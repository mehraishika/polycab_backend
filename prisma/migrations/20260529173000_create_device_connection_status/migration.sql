-- CreateTable
CREATE TABLE "device_connection_status" (
    "id" BIGSERIAL NOT NULL,
    "serial_number" VARCHAR(255) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "lastSeenTime" TIMESTAMPTZ(6),

    CONSTRAINT "device_connection_status_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_connection_status_serial_number_key"
ON "device_connection_status"("serial_number");

-- CreateIndex
CREATE INDEX "idx_device_connection_status_status"
ON "device_connection_status"("status");
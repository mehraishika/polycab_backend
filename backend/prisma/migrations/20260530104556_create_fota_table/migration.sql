-- CreateTable
CREATE TABLE "fota" (
    "id" SERIAL NOT NULL,
    "mac_address" VARCHAR(50) NOT NULL,
    "firmware" VARCHAR(50),
    "link" VARCHAR(255),

    CONSTRAINT "fota_pkey" PRIMARY KEY ("mac_address")
);

-- CreateIndex
CREATE UNIQUE INDEX "fota_id_key" ON "fota"("id");

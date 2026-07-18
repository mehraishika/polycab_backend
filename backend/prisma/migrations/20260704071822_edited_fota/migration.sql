/*
  Warnings:

  - The primary key for the `fota` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[id]` on the table `fota` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "fota_mac_address_key";

-- AlterTable
ALTER TABLE "fota" DROP CONSTRAINT "fota_pkey",
ADD CONSTRAINT "fota_pkey" PRIMARY KEY ("mac_address");

-- CreateIndex
CREATE UNIQUE INDEX "fota_id_key" ON "fota"("id");

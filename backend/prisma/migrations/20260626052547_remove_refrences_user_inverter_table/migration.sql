-- DropForeignKey
ALTER TABLE "user_plant_inverter_map" DROP CONSTRAINT "user_plant_inverter_map_inverter_no_fkey";

-- DropForeignKey
ALTER TABLE "user_plant_inverter_map" DROP CONSTRAINT "user_plant_inverter_map_plant_id_fkey";

-- AlterTable
ALTER TABLE "user_plant_inverter_map" ALTER COLUMN "plant_id" DROP NOT NULL;

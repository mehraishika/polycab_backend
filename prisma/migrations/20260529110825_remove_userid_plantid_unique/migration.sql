-- DropIndex
DROP INDEX "user_plant_inverter_map_user_id_plant_id_inverter_no_is_del_key";

-- AlterTable
ALTER TABLE "device_daily_summary_per_line_chart" ADD COLUMN     "dc_voltage_9" INTEGER;

-- AlterTable
ALTER TABLE "device_logs_latest" ALTER COLUMN "inverter_name" SET DATA TYPE TEXT;

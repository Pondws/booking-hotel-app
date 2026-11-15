-- AlterTable
ALTER TABLE "hotels" ADD COLUMN     "check_in_time" VARCHAR(5) NOT NULL DEFAULT '14:00',
ADD COLUMN     "check_out_time" VARCHAR(5) NOT NULL DEFAULT '12:00';

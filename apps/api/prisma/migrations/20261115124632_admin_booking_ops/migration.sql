-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "cancel_reason" TEXT,
ADD COLUMN     "checked_in_at" TIMESTAMP(3),
ADD COLUMN     "checked_out_at" TIMESTAMP(3);

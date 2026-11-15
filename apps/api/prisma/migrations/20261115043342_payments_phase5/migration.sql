-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "refunded_at" TIMESTAMP(3);

-- At most one live (PENDING/SUCCEEDED) payment per booking (raw SQL; Prisma can't express partial indexes).
CREATE UNIQUE INDEX "payments_one_active_per_booking" ON "payments" ("booking_id")
  WHERE "status" IN ('PENDING', 'SUCCEEDED');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "points_earned" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "points_redeemed" INTEGER NOT NULL DEFAULT 0;

-- Raw-SQL constraint (see schema.prisma)
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_points_check" CHECK ("points_redeemed" >= 0 AND "points_earned" >= 0);

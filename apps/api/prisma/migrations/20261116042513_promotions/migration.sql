-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('EARLY_BIRD', 'LAST_MINUTE', 'LONG_STAY', 'CODE');

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'PROMOTION';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "discount_label" VARCHAR(80),
ADD COLUMN     "promotion_id" TEXT;

-- CreateTable
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL,
    "hotel_id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "type" "PromotionType" NOT NULL,
    "percent_off" INTEGER NOT NULL,
    "min_nights" INTEGER NOT NULL DEFAULT 1,
    "min_days_ahead" INTEGER,
    "max_days_ahead" INTEGER,
    "code" VARCHAR(30),
    "valid_from" DATE,
    "valid_until" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "promotions_code_key" ON "promotions"("code");

-- CreateIndex
CREATE INDEX "promotions_hotel_id_is_active_idx" ON "promotions"("hotel_id", "is_active");

-- CreateIndex
CREATE INDEX "bookings_promotion_id_idx" ON "bookings"("promotion_id");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Raw-SQL constraints (see schema.prisma)
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_percent_check" CHECK ("percent_off" BETWEEN 1 AND 90);
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_min_nights_check" CHECK ("min_nights" >= 1);
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_valid_check" CHECK ("valid_until" >= "valid_from");
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_discount_check" CHECK ("discount_amount" >= 0);

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "hidden_at" TIMESTAMP(3),
ADD COLUMN     "is_hidden" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "reviews_hotel_id_is_hidden_created_at_idx" ON "reviews"("hotel_id", "is_hidden", "created_at");

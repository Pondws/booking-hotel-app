-- CreateEnum
CREATE TYPE "SupportTopic" AS ENUM ('CHANGE_BOOKING', 'CANCELLATION', 'PAYMENT', 'SPECIAL_REQUEST', 'OTHER');

-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "support_requests" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "hotel_id" TEXT NOT NULL,
    "topic" "SupportTopic" NOT NULL,
    "message" VARCHAR(2000) NOT NULL,
    "status" "SupportStatus" NOT NULL DEFAULT 'OPEN',
    "reply" VARCHAR(2000),
    "resolved_at" TIMESTAMP(3),
    "resolved_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_requests_booking_id_idx" ON "support_requests"("booking_id");

-- CreateIndex
CREATE INDEX "support_requests_user_id_idx" ON "support_requests"("user_id");

-- CreateIndex
CREATE INDEX "support_requests_resolved_by_id_idx" ON "support_requests"("resolved_by_id");

-- CreateIndex
CREATE INDEX "support_requests_hotel_id_status_created_at_idx" ON "support_requests"("hotel_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "support_requests_status_created_at_idx" ON "support_requests"("status", "created_at");

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

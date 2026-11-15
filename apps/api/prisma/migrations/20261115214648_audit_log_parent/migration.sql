-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "parent_id" TEXT;

-- CreateIndex
CREATE INDEX "audit_logs_parent_id_created_at_idx" ON "audit_logs"("parent_id", "created_at");

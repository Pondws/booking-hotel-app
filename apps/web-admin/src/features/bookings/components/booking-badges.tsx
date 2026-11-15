import type { AdminBookingStatusFilter, BookingStatus, PaymentStatus } from "@booking/shared";
import { Badge } from "@booking/ui/components/badge";

export type BookingStage = Exclude<AdminBookingStatusFilter, "all">;

export const STAGE_LABELS: Record<BookingStage, string> = {
  PENDING: "รอชำระเงิน",
  CONFIRMED: "รอเข้าพัก",
  CHECKED_IN: "เข้าพักอยู่",
  COMPLETED: "เช็คเอาท์แล้ว",
  CANCELLED: "ยกเลิกแล้ว",
  EXPIRED: "หมดเวลาชำระ",
};

const STAGE_VARIANTS: Record<BookingStage, "default" | "secondary" | "outline"> = {
  PENDING: "outline",
  CONFIRMED: "secondary",
  CHECKED_IN: "default",
  COMPLETED: "outline",
  CANCELLED: "outline",
  EXPIRED: "outline",
};

/** "Checked in" isn't a DB status: it is CONFIRMED with `checkedInAt`. */
export function stageOf(status: BookingStatus, checkedIn: boolean): BookingStage {
  return status === "CONFIRMED" && checkedIn ? "CHECKED_IN" : status;
}

export function BookingStatusBadge({ status, checkedIn }: { status: BookingStatus; checkedIn: boolean }) {
  const stage = stageOf(status, checkedIn);
  return <Badge variant={STAGE_VARIANTS[stage]}>{STAGE_LABELS[stage]}</Badge>;
}

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  PENDING: "รอชำระ",
  SUCCEEDED: "ชำระแล้ว",
  FAILED: "ชำระไม่สำเร็จ",
  REFUNDED: "คืนเงินแล้ว",
};

/** A paid booking that is cancelled means the refund failed — it needs checking. */
export function needsRefund(status: BookingStatus, payment: PaymentStatus | null): boolean {
  return status === "CANCELLED" && payment === "SUCCEEDED";
}

export function PaymentStatusBadge({ status, bookingStatus }: { status: PaymentStatus | null; bookingStatus: BookingStatus }) {
  if (needsRefund(bookingStatus, status)) return <Badge variant="destructive">คืนเงินไม่สำเร็จ</Badge>;
  if (status === null) return <Badge variant="outline">ยังไม่ชำระ</Badge>;
  return <Badge variant={status === "SUCCEEDED" ? "secondary" : "outline"}>{PAYMENT_LABELS[status]}</Badge>;
}

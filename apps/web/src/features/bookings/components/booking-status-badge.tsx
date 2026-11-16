import type { Booking } from "@booking/shared";
import { Badge } from "@booking/ui/components/badge";

type Variant = "default" | "secondary" | "outline";

const BADGES: Record<Booking["status"], { label: string; variant: Variant }> = {
  PENDING: { label: "รอชำระเงิน", variant: "secondary" },
  CONFIRMED: { label: "ยืนยันแล้ว", variant: "default" },
  CANCELLED: { label: "ยกเลิกแล้ว", variant: "outline" },
  EXPIRED: { label: "หมดเวลา", variant: "outline" },
  COMPLETED: { label: "เข้าพักแล้ว", variant: "outline" },
};

export function BookingStatusBadge({ status }: { status: Booking["status"] }) {
  const { label, variant } = BADGES[status];
  return <Badge variant={variant}>{label}</Badge>;
}

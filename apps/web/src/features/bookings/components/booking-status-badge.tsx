import type { Booking } from "@booking/shared";
import { Badge } from "@booking/ui/components/badge";

type Variant = "default" | "secondary" | "outline";

const BADGES: Record<Booking["status"], { label: string; variant: Variant }> = {
  PENDING: { label: "Awaiting payment", variant: "secondary" },
  CONFIRMED: { label: "Confirmed", variant: "default" },
  CANCELLED: { label: "Cancelled", variant: "outline" },
  EXPIRED: { label: "Expired", variant: "outline" },
  COMPLETED: { label: "Completed", variant: "outline" },
};

export function BookingStatusBadge({ status }: { status: Booking["status"] }) {
  const { label, variant } = BADGES[status];
  return <Badge variant={variant}>{label}</Badge>;
}

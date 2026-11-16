import {
  ArrowLeftRight,
  Ban,
  Building2,
  Eye,
  EyeOff,
  ImageIcon,
  KeyRound,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import type { AdminAuditLog, AuditChange } from "@booking/shared";

export type ActivityVariant = "default" | "primary" | "secondary" | "muted" | "destructive";

/** What a history row means to staff: a verb, its icon and how loud the icon is. */
export type Activity = { icon: LucideIcon; label: string; variant: ActivityVariant };

const changeOf = (log: AdminAuditLog, field: string): AuditChange | undefined =>
  log.changes.find((c) => c.field === field);

const only = (log: AdminAuditLog, field: string) => log.changes.length === 1 && log.changes[0]?.field === field;

/** Booking actions are status moves (see the API's `bookingSnapshot`: CHECKED_IN = confirmed + checked in). */
function bookingActivity(log: AdminAuditLog): Activity | null {
  const status = changeOf(log, "status")?.after;
  if (status === "CHECKED_IN") return { icon: LogIn, label: "เช็คอิน", variant: "primary" };
  if (status === "COMPLETED") return { icon: LogOut, label: "เช็คเอาท์", variant: "secondary" };
  if (status === "CANCELLED") return { icon: Ban, label: "ยกเลิกการจอง", variant: "destructive" };
  if (changeOf(log, "room")) return { icon: ArrowLeftRight, label: "ย้ายห้อง", variant: "default" };
  return null;
}

export function activityOf(log: AdminAuditLog): Activity {
  if (log.action === "CREATE") return { icon: Plus, label: "สร้าง", variant: "primary" };
  if (log.action === "DELETE") return { icon: Trash2, label: "ลบ", variant: "destructive" };

  const booking = log.entityType === "BOOKING" ? bookingActivity(log) : null;
  if (booking) return booking;
  if (only(log, "isActive")) {
    return changeOf(log, "isActive")?.after === true
      ? { icon: Power, label: "เปิดใช้งาน", variant: "secondary" }
      : { icon: PowerOff, label: "ปิดใช้งาน", variant: "muted" };
  }
  if (only(log, "isHidden")) {
    return changeOf(log, "isHidden")?.after === true
      ? { icon: EyeOff, label: "ซ่อนรีวิว", variant: "muted" }
      : { icon: Eye, label: "แสดงรีวิว", variant: "secondary" };
  }
  if (only(log, "password")) return { icon: KeyRound, label: "ตั้งรหัสผ่านใหม่", variant: "default" };
  if (only(log, "hotels")) return { icon: Building2, label: "เปลี่ยนโรงแรมที่ดูแล", variant: "default" };
  if (only(log, "images")) return { icon: ImageIcon, label: "แก้ไขรูปภาพ", variant: "default" };
  return { icon: Pencil, label: "แก้ไข", variant: "default" };
}

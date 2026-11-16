import {
  Building2,
  CalendarCheck,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@booking/shared";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Only these roles see the link (the API enforces access either way). Everyone when omitted. */
  roles?: Role[];
};

/** Sidebar navigation; later phases append their sections here. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "ภาพรวม", icon: LayoutDashboard },
  { href: "/hotels", label: "โรงแรม", icon: Building2 },
  { href: "/bookings", label: "การจอง", icon: CalendarCheck },
  { href: "/reviews", label: "รีวิว", icon: MessageSquare },
  { href: "/support", label: "ข้อความจากลูกค้า", icon: Inbox },
  { href: "/staff", label: "พนักงาน", icon: Users, roles: ["ADMIN"] },
  { href: "/amenities", label: "สิ่งอำนวยความสะดวก", icon: Sparkles, roles: ["ADMIN"] },
];

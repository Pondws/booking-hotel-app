import type { ComponentType } from "react";
import { Building2, CalendarCheck, type LucideIcon } from "lucide-react";
import { BookingNavPanel } from "@/features/bookings/components/booking-nav-panel";
import { HotelNavPanel } from "@/features/hotels/components/hotel-nav-panel";

/** `panel` fills the sidebar's second column while the section is active (header + content). */
export type NavItem = { href: string; label: string; icon: LucideIcon; panel: ComponentType };

/** Sidebar navigation (icon rail); later phases append their sections here. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/hotels", label: "โรงแรม", icon: Building2, panel: HotelNavPanel },
  { href: "/bookings", label: "การจอง", icon: CalendarCheck, panel: BookingNavPanel },
];

import {
  BedDouble,
  Building2,
  CalendarCheck,
  Clock,
  List,
  LogIn,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { BOOKING_TZ, todayIn, type AdminBookingListQuery } from "@booking/shared";
import { serializeListParams as bookingsSearch } from "@/features/bookings/list-params";

/** `href` is a function when it depends on the current date. */
export type SubNavItem = { label: string; href: string | (() => string); icon: LucideIcon };

/** Icon rail entry; `children` is the sub menu shown in the sidebar's second column. */
export type NavItem = { href: string; label: string; icon: LucideIcon; children: SubNavItem[] };

const bookings = (q: Partial<AdminBookingListQuery>) => `/bookings${bookingsSearch(q)}`;

/** Sidebar navigation; later phases append their sections here. */
export const NAV_ITEMS: NavItem[] = [
  {
    href: "/hotels",
    label: "โรงแรม",
    icon: Building2,
    children: [
      { label: "โรงแรมทั้งหมด", href: "/hotels", icon: List },
      { label: "เพิ่มโรงแรม", href: "/hotels/new", icon: Plus },
    ],
  },
  {
    href: "/bookings",
    label: "การจอง",
    icon: CalendarCheck,
    children: [
      { label: "การจองทั้งหมด", href: "/bookings", icon: List },
      {
        // from/to match stays overlapping the range → confirmed guests due here today, not yet checked in
        label: "รอเช็คอินวันนี้",
        href: () => {
          const today = todayIn(BOOKING_TZ);
          return bookings({ status: "CONFIRMED", from: today, to: today });
        },
        icon: LogIn,
      },
      { label: "เข้าพักอยู่", href: bookings({ status: "CHECKED_IN" }), icon: BedDouble },
      { label: "รอชำระเงิน", href: bookings({ status: "PENDING" }), icon: Clock },
    ],
  },
];

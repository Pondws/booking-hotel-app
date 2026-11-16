/** Main navigation (header) — pages marked `soon` are placeholders until their phase ships (PLAN.md Phase 11). */
export const MAIN_NAV = [
  { href: "/hotels", label: "ที่พัก" },
  { href: "/destinations", label: "จุดหมายปลายทาง", soon: true },
  { href: "/deals", label: "ดีลพิเศษ", soon: true },
  { href: "/rewards", label: "สมาชิกรางวัล", soon: true },
] as const;

export const FOOTER_NAV = [
  {
    title: "ค้นหาที่พัก",
    links: [
      { href: "/hotels", label: "โรงแรมทั้งหมด" },
      { href: "/destinations", label: "จุดหมายปลายทาง" },
      { href: "/deals", label: "ดีลพิเศษ" },
    ],
  },
  {
    title: "บัญชีของฉัน",
    links: [
      { href: "/account/bookings", label: "การจองของฉัน" },
      { href: "/wishlist", label: "รายการโปรด" },
      { href: "/rewards", label: "สมาชิกรางวัล" },
      { href: "/account", label: "ข้อมูลบัญชี" },
    ],
  },
  {
    title: "ช่วยเหลือ",
    links: [
      { href: "/help", label: "ศูนย์ช่วยเหลือ" },
      { href: "/help#cancellation", label: "นโยบายการยกเลิก" },
      { href: "/help#payment", label: "การชำระเงิน" },
    ],
  },
] as const;

import { Building2, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

/** Sidebar navigation; later phases append their sections here. */
export const NAV_ITEMS: NavItem[] = [{ href: "/hotels", label: "Hotels", icon: Building2 }];

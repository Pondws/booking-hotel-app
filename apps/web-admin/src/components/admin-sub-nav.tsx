"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@booking/ui/components/sidebar";
import { isActivePath } from "@/lib/is-active-path";
import type { SubNavItem } from "./nav-items";

/** Paging/size don't change which sub menu entry you're on. */
const IGNORED_PARAMS = new Set(["page", "pageSize"]);

type Resolved = { item: SubNavItem; href: string; url: URL };

/**
 * The entry for the current URL: an exact path whose query params are all present (the one with the
 * most params wins — "รอชำระเงิน" over "การจองทั้งหมด"); else the deepest path above the current page.
 */
function findActive(items: Resolved[], pathname: string, search: URLSearchParams): Resolved | undefined {
  const exact = items
    .filter(({ url }) => url.pathname === pathname)
    .filter(({ url }) =>
      [...url.searchParams].every(([k, v]) => IGNORED_PARAMS.has(k) || search.get(k) === v),
    )
    .sort((a, b) => [...b.url.searchParams].length - [...a.url.searchParams].length);
  if (exact[0]) return exact[0];
  return items
    .filter(({ url }) => isActivePath(pathname, url.pathname))
    .sort((a, b) => b.url.pathname.length - a.url.pathname.length)[0];
}

function SubNavLinks({ items, activeHref }: { items: Resolved[]; activeHref: string | undefined }) {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenu>
      {items.map(({ item, href }) => {
        const active = href === activeHref;
        return (
          <SidebarMenuItem key={item.label}>
            <SidebarMenuButton asChild isActive={active}>
              <Link href={href} onClick={() => setOpenMobile(false)} aria-current={active ? "page" : undefined}>
                <item.icon />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

function SubNavFromUrl({ items }: { items: Resolved[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return <SubNavLinks items={items} activeHref={findActive(items, pathname, searchParams)?.href} />;
}

/** The active section's sub menu (sidebar second column). */
export function AdminSubNav({ items }: { items: SubNavItem[] }) {
  const resolved = items.map((item) => {
    const href = typeof item.href === "function" ? item.href() : item.href;
    // Base only for parsing a relative href
    return { item, href, url: new URL(href, "http://admin.local") };
  });
  return (
    // useSearchParams needs a Suspense boundary; the fallback is the same links with nothing active
    <Suspense fallback={<SubNavLinks items={resolved} activeHref={undefined} />}>
      <SubNavFromUrl items={resolved} />
    </Suspense>
  );
}

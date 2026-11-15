/** True when `pathname` is `href` or a page below it (`/hotels` matches `/hotels/abc`, not `/hotels-x`). */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

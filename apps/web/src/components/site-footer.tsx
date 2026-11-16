import Link from "next/link";
import { CreditCard, ShieldCheck } from "lucide-react";
import { FOOTER_NAV } from "./nav-links";
import { Logo } from "./site-header";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t bg-muted">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="text-sm text-muted-foreground">
            ค้นหาโรงแรม เห็นห้องว่างและราคารวมจริงก่อนจอง ยกเลิกได้ก่อนวันเช็คอินและได้เงินคืนเต็มจำนวน
          </p>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <ShieldCheck aria-hidden className="size-4" />
              ชำระเงินปลอดภัยผ่าน Stripe
            </li>
            <li className="flex items-center gap-2">
              <CreditCard aria-hidden className="size-4" />
              รองรับบัตรเครดิต/เดบิต
            </li>
          </ul>
        </div>
        {FOOTER_NAV.map((group) => (
          <nav key={group.title} aria-label={group.title} className="space-y-3">
            <h2 className="text-sm font-semibold">{group.title}</h2>
            <ul className="space-y-2 text-sm">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t">
        <p className="mx-auto w-full max-w-6xl px-4 py-4 text-xs text-muted-foreground">
          © Booking Hotel · โปรเจกต์ฝึกหัด ระบบชำระเงินอยู่ในโหมดทดสอบ
        </p>
      </div>
    </footer>
  );
}

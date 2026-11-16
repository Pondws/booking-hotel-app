"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { promoCodeField, type Availability } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Input } from "@booking/ui/components/input";
import { Label } from "@booking/ui/components/label";

type Props = {
  /** The code in the URL (already normalised). */
  current: string | undefined;
  /** What the API said about it; undefined while the quote loads. */
  status: Availability["promoCode"] | undefined;
  /** The code the quote actually used (a bigger automatic deal can win). */
  appliedCode: string | null | undefined;
};

/** Promo code box on /book. The code lives in the URL (`promo`), so the quote and the hold both use it. */
export function PromoCodeForm({ current, status, appliedCode }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const setCode = (code: string | null) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (code === null) sp.delete("promo");
    else sp.set("promo", code);
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  if (current) {
    const invalid = status?.valid === false;
    const outranked = status?.valid === true && appliedCode !== undefined && appliedCode !== current;
    return (
      <div className="space-y-1 rounded-md border p-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span>
            โค้ด <span className="font-medium tabular-nums">{current}</span>
          </span>
          <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={() => setCode(null)}>
            ลบโค้ด
          </Button>
        </div>
        {invalid && (
          <p role="alert" className="text-destructive">
            ใช้โค้ดนี้กับการเข้าพักนี้ไม่ได้
          </p>
        )}
        {outranked && <p className="text-muted-foreground">มีดีลอื่นที่คุ้มกว่า ระบบจึงใช้ดีลนั้นแทน</p>}
      </div>
    );
  }

  return (
    <form
      noValidate
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = promoCodeField.safeParse(value);
        if (!parsed.success) {
          setError("กรอกโค้ด 3–30 ตัว ใช้ตัวอักษรภาษาอังกฤษหรือตัวเลข");
          return;
        }
        setError(null);
        setValue("");
        setCode(parsed.data);
      }}
    >
      <Label htmlFor="promo-code">โค้ดส่วนลด</Label>
      <div className="flex gap-2">
        <Input
          id="promo-code"
          value={value}
          autoComplete="off"
          aria-invalid={error !== null}
          aria-describedby={error ? "promo-code-error" : undefined}
          onChange={(event) => setValue(event.target.value)}
        />
        <Button type="submit" variant="outline">
          ใช้โค้ด
        </Button>
      </div>
      {error && (
        <p id="promo-code-error" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

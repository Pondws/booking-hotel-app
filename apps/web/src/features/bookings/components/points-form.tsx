"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { POINTS_MIN_REDEEM, maxRedeemablePoints } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Input } from "@booking/ui/components/input";
import { Label } from "@booking/ui/components/label";
import { useMyRewards } from "@/features/rewards/hooks";

type Props = {
  /** Points in the URL (`points`); 0 = none. */
  current: number;
  /** The quote's price after deals; undefined while it loads or the room is gone. */
  total: number | undefined;
};

const fmt = (n: number) => n.toLocaleString("th-TH");

/** "Use points" box on /book. The amount lives in the URL so the hold sends it; the API re-checks everything. */
export function PointsForm({ current, total }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rewards = useMyRewards();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!rewards.data || total === undefined) return null;
  const { balance } = rewards.data;
  if (balance <= 0 && current === 0) return null;
  const max = maxRedeemablePoints(balance, total);

  const setPoints = (points: number) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (points === 0) sp.delete("points");
    else sp.set("points", String(points));
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  if (current > 0) {
    const tooMany = current > max;
    return (
      <div className="space-y-1 rounded-md border p-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span>
            ใช้ <span className="font-medium tabular-nums">{fmt(current)}</span> แต้ม
          </span>
          <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={() => setPoints(0)}>
            ไม่ใช้แต้ม
          </Button>
        </div>
        {tooMany && (
          <p role="alert" className="text-destructive">
            ใช้ได้สูงสุด {fmt(max)} แต้มสำหรับการจองนี้
          </p>
        )}
      </div>
    );
  }

  if (max === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        คุณมี {fmt(balance)} แต้ม ใช้เป็นส่วนลดได้เมื่อมีอย่างน้อย {fmt(POINTS_MIN_REDEEM)} แต้ม
      </p>
    );
  }

  return (
    <form
      noValidate
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        const n = Number(value);
        if (!Number.isInteger(n) || n < POINTS_MIN_REDEEM || n > max) {
          setError(`กรอก ${fmt(POINTS_MIN_REDEEM)}–${fmt(max)} แต้ม`);
          return;
        }
        setError(null);
        setValue("");
        setPoints(n);
      }}
    >
      <Label htmlFor="points">ใช้แต้มเป็นส่วนลด</Label>
      <p id="points-hint" className="text-sm text-muted-foreground">
        มี {fmt(balance)} แต้ม · ใช้ได้สูงสุด {fmt(max)} แต้ม (1 แต้ม = ฿1)
      </p>
      <div className="flex gap-2">
        <Input
          id="points"
          type="number"
          inputMode="numeric"
          min={POINTS_MIN_REDEEM}
          max={max}
          value={value}
          aria-invalid={error !== null}
          aria-describedby={error ? "points-hint points-error" : "points-hint"}
          onChange={(event) => setValue(event.target.value)}
        />
        <Button type="button" variant="ghost" onClick={() => setValue(String(max))}>
          สูงสุด
        </Button>
        <Button type="submit" variant="outline">
          ใช้แต้ม
        </Button>
      </div>
      {error && (
        <p id="points-error" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

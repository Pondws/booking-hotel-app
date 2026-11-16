"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { Appearance } from "@stripe/stripe-js";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Booking } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Skeleton } from "@booking/ui/components/skeleton";
import { bookingKeys } from "@/features/bookings/hooks";
import { formatMoney } from "@/features/hotels/format";
import { ApiError } from "@/lib/api";
import { useStartPayment, useSyncPayment } from "../hooks";
import { stripePromise } from "../stripe";

/** How long to wait for the webhook after a successful confirm before saying "still processing". */
const CONFIRM_WAIT_MS = 30_000;

type Props = {
  booking: Booking;
  /** `true` asks the parent to poll the booking until it is CONFIRMED; `false` stops it. */
  onStillPending: (polling: boolean) => void;
};

export function PayCard({ booking, onStillPending }: Props) {
  if (stripePromise === null) {
    return (
      <section aria-labelledby="pay-heading" className="space-y-2 rounded-xl border p-4">
        <h2 id="pay-heading" className="text-lg font-semibold">
          การชำระเงิน
        </h2>
        <p className="text-sm text-muted-foreground">ยังไม่ได้ตั้งค่าระบบชำระเงิน</p>
      </section>
    );
  }
  return <PayCardWithStripe booking={booking} onStillPending={onStillPending} />;
}

function PayCardWithStripe({ booking, onStillPending }: Props) {
  const { code } = booking;
  const queryClient = useQueryClient();
  const sync = useSyncPayment(code);
  const router = useRouter();
  const pathname = usePathname();

  // Returning from a 3-D Secure redirect (?payment_intent=…&redirect_status=…): settle first, then
  // drop the params so a reload doesn't repeat it.
  // Client-only read is safe: this card renders only after the booking query has loaded in the browser.
  const [returning, setReturning] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("redirect_status"),
  );
  const syncRef = useRef(sync.mutate);
  useEffect(() => {
    syncRef.current = sync.mutate;
  });
  const returnHandled = useRef(false);
  useEffect(() => {
    if (!returning || returnHandled.current) return;
    returnHandled.current = true;
    syncRef.current(undefined, {
      onSettled: () => {
        router.replace(pathname);
        setReturning(false);
      },
    });
  }, [returning, pathname, router]);

  const start = useStartPayment(code, booking.payable && !returning);
  const notPayable = start.error instanceof ApiError && start.error.status === 409;
  useEffect(() => {
    // Paid, expired or cancelled meanwhile: show the booking as it really is
    if (notPayable) void queryClient.invalidateQueries({ queryKey: bookingKeys.detail(code) });
  }, [notPayable, queryClient, code]);

  return (
    <section aria-labelledby="pay-heading" className="space-y-4 rounded-xl border p-4">
      <h2 id="pay-heading" className="text-lg font-semibold">
        ชำระเงิน {formatMoney(booking.totalAmount, booking.currency)}
      </h2>
      {start.data ? (
        <Elements
          key={start.data.clientSecret}
          stripe={stripePromise}
          options={{ clientSecret: start.data.clientSecret, appearance: themeAppearance(), locale: "th" }}
        >
          <PayForm booking={booking} onStillPending={onStillPending} />
        </Elements>
      ) : start.isError && !notPayable ? (
        <div role="alert" className="space-y-3">
          <p className="text-sm">เริ่มการชำระเงินไม่ได้ในขณะนี้</p>
          <Button variant="outline" onClick={() => void start.refetch()} disabled={start.isFetching}>
            {start.isFetching ? "กำลังลองใหม่…" : "ลองใหม่"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3" role="status" aria-busy="true" aria-label="กำลังโหลดฟอร์มชำระเงิน">
          {returning && <p className="text-sm text-muted-foreground">กำลังยืนยันการชำระเงิน…</p>}
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-1/3" />
        </div>
      )}
    </section>
  );
}

type Phase = "idle" | "submitting" | "confirming" | "slow";

function PayForm({ booking, onStillPending }: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const sync = useSyncPayment(booking.code);
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  const onStillPendingRef = useRef(onStillPending);
  useEffect(() => {
    onStillPendingRef.current = onStillPending;
  });
  useEffect(() => {
    if (phase !== "confirming") return;
    onStillPendingRef.current(true);
    const timer = setTimeout(() => setPhase("slow"), CONFIRM_WAIT_MS);
    return () => clearTimeout(timer);
  }, [phase]);
  useEffect(() => {
    if (phase === "slow") onStillPendingRef.current(false);
  }, [phase]);
  useEffect(() => () => onStillPendingRef.current(false), []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements || phase !== "idle") return;
    setError(null);
    setPhase("submitting");
    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: { return_url: window.location.href },
    });
    if (result.error) {
      // Declined / invalid card: keep the form, show Stripe's message
      setError(result.error.message ?? "ชำระเงินไม่สำเร็จ ลองใช้บัตรใบอื่น");
      setPhase("idle");
      return;
    }
    sync.mutate(undefined, {
      onSuccess: (fresh) => {
        if (fresh.status !== "CONFIRMED") setPhase("confirming");
      },
      // The webhook still confirms it; keep polling the booking
      onError: () => setPhase("confirming"),
    });
  };

  if (phase === "confirming" || phase === "slow") {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {phase === "confirming" ? "กำลังยืนยันการชำระเงิน…" : "ยังดำเนินการอยู่ ลองรีเฟรชหน้านี้อีกครั้งในอีกสักครู่"}
      </p>
    );
  }

  const submitting = phase === "submitting" || sync.isPending;
  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      {!ready && <Skeleton className="h-32 w-full" />}
      <PaymentElement onReady={() => setReady(true)} />
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={!stripe || !elements || !ready || submitting}>
        {submitting ? "กำลังชำระเงิน…" : `ชำระเงิน ${formatMoney(booking.totalAmount, booking.currency)}`}
      </Button>
      <p className="text-xs text-muted-foreground">
        โหมดทดสอบ — ใช้บัตร 4242 4242 4242 4242 วันหมดอายุในอนาคตและ CVC ใดก็ได้
      </p>
    </form>
  );
}

/**
 * Stripe renders the Element in its own iframe, so it can't read our CSS variables: copy the radius
 * token from the page. Colours and font stay on Stripe's neutral theme (our `oklch` tokens and the
 * self-hosted Geist font don't reach the iframe without extra setup).
 */
function themeAppearance(): Appearance {
  if (typeof window === "undefined") return { theme: "stripe" };
  const radius = getComputedStyle(document.documentElement).getPropertyValue("--radius").trim();
  return { theme: "stripe", ...(radius ? { variables: { borderRadius: radius } } : {}) };
}

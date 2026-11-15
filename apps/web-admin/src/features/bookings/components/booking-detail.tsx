"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { AdminBooking } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@booking/ui/components/card";
import { Skeleton } from "@booking/ui/components/skeleton";
import { formatDate, formatMoney } from "@/features/room-types/format";
import { ApiError } from "@/lib/api";
import { BookingActions } from "./booking-actions";
import { BookingStatusBadge, PAYMENT_LABELS, PaymentStatusBadge, needsRefund } from "./booking-badges";

const dateTimeFormat = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Bangkok",
});

const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso));

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="col-span-2 min-w-0 break-words">{children}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y">{children}</dl>
      </CardContent>
    </Card>
  );
}

export function BookingDetail({ booking }: { booking: AdminBooking }) {
  const { payment } = booking;
  const refundFailed = needsRefund(booking.status, payment?.status ?? null);

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <div className="space-y-1">
          <Link href="/bookings" className="text-sm text-muted-foreground hover:underline">
            การจอง
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-2xl font-semibold tracking-tight">{booking.code}</h1>
            <BookingStatusBadge status={booking.status} checkedIn={booking.checkedIn} />
          </div>
          <p className="text-sm text-muted-foreground">
            {booking.guestName} · {booking.hotel.name}
          </p>
        </div>
        <BookingActions booking={booking} />
      </header>

      {refundFailed && (
        <div role="alert" className="rounded-lg border border-destructive p-4 text-sm">
          <p className="font-medium text-destructive">คืนเงินไม่สำเร็จ</p>
          <p className="text-muted-foreground">
            การจองถูกยกเลิกแล้วแต่การชำระเงินยังไม่ถูกคืน ตรวจสอบและคืนเงินในระบบชำระเงิน ({payment?.provider})
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="การเข้าพัก">
          <Row label="โรงแรม">
            <Link href={`/hotels/${booking.hotel.id}`} className="hover:underline">
              {booking.hotel.name}
            </Link>
          </Row>
          <Row label="ประเภทห้อง">{booking.roomType.name}</Row>
          <Row label="ห้อง">{booking.room.number}</Row>
          <Row label="เช็คอิน">
            {formatDate(booking.checkIn)} <span className="text-muted-foreground">ตั้งแต่ {booking.hotel.checkInTime}</span>
          </Row>
          <Row label="เช็คเอาท์">
            {formatDate(booking.checkOut)}{" "}
            <span className="text-muted-foreground">ก่อน {booking.hotel.checkOutTime}</span>
          </Row>
          <Row label="จำนวน">
            {booking.nights} คืน · {booking.guests} คน
          </Row>
        </Section>

        <Section title="ผู้เข้าพัก">
          <Row label="ชื่อ">{booking.guestName}</Row>
          <Row label="อีเมล">{booking.guestEmail}</Row>
          <Row label="โทรศัพท์">{booking.guestPhone ?? <span className="text-muted-foreground">—</span>}</Row>
          <Row label="บัญชีที่จอง">
            {booking.customer.name}
            <span className="block text-xs text-muted-foreground">{booking.customer.email}</span>
          </Row>
        </Section>

        <Section title="การชำระเงิน">
          <Row label="ยอดรวม">
            <span className="font-semibold tabular-nums">{formatMoney(booking.totalAmount, booking.currency)}</span>{" "}
            <span className="text-muted-foreground">({booking.nights} คืน)</span>
          </Row>
          <Row label="สถานะ">
            <PaymentStatusBadge status={payment?.status ?? null} bookingStatus={booking.status} />
          </Row>
          {payment && (
            <>
              <Row label="ชำระเมื่อ">
                {payment.paidAt ? formatDateTime(payment.paidAt) : <span className="text-muted-foreground">—</span>}
              </Row>
              {payment.refundedAt && <Row label="คืนเงินเมื่อ">{formatDateTime(payment.refundedAt)}</Row>}
              <Row label="ผู้ให้บริการ">
                {payment.provider}{" "}
                <span className="text-muted-foreground">· {PAYMENT_LABELS[payment.status]}</span>
              </Row>
            </>
          )}
        </Section>

        <Section title="ประวัติ">
          <Row label="จองเมื่อ">{formatDateTime(booking.createdAt)}</Row>
          {booking.status === "PENDING" && booking.expiresAt && (
            <Row label="หมดเวลาชำระ">{formatDateTime(booking.expiresAt)}</Row>
          )}
          {booking.checkedInAt && <Row label="เช็คอินเมื่อ">{formatDateTime(booking.checkedInAt)}</Row>}
          {booking.checkedOutAt && <Row label="เช็คเอาท์เมื่อ">{formatDateTime(booking.checkedOutAt)}</Row>}
          {booking.cancelledAt && <Row label="ยกเลิกเมื่อ">{formatDateTime(booking.cancelledAt)}</Row>}
          {booking.status === "CANCELLED" && (
            <Row label="เหตุผล">
              {booking.cancelReason ?? <span className="text-muted-foreground">ลูกค้ายกเลิกเอง</span>}
            </Row>
          )}
        </Section>
      </div>
    </div>
  );
}

export function BookingPageError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  if (error instanceof ApiError && error.status === 404) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">ไม่พบการจอง</h1>
        <p className="text-sm text-muted-foreground">รหัสการจองไม่ถูกต้อง หรือเป็นการจองของโรงแรมที่คุณไม่ได้ดูแล</p>
        <Button asChild variant="link" className="px-0">
          <Link href="/bookings">กลับไปที่รายการการจอง</Link>
        </Button>
      </div>
    );
  }
  return (
    <div role="alert" className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">โหลดการจองไม่สำเร็จ</h1>
      <Button variant="outline" onClick={onRetry}>
        ลองอีกครั้ง
      </Button>
    </div>
  );
}

export function BookingPageSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-56 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

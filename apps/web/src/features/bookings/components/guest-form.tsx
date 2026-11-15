"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { HOLD_MINUTES, createBookingSchema, type CreateBookingData } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Input } from "@booking/ui/components/input";
import { Label } from "@booking/ui/components/label";
import { useMe } from "@/features/auth/hooks";
import { toSearchParams } from "@/features/hotels/search-params";
import { ApiError } from "@/lib/api";
import { applyServerFieldErrors, formErrorMessage } from "@/lib/form-errors";
import { useCreateBooking } from "../hooks";

type FormInput = z.input<typeof createBookingSchema>;
type FormOutput = z.output<typeof createBookingSchema>;

type FormAlert = { kind: "unavailable" } | { kind: "conflict" | "generic"; message: string };

type Props = {
  hotelSlug: string;
  /** Stay and room type from the URL; sent with the guest details. */
  stay: CreateBookingData;
  /** False while the live quote is loading, failed, or sold out. */
  canHold: boolean;
};

export function GuestForm({ hotelSlug, stay, canHold }: Props) {
  const router = useRouter();
  const { data: me } = useMe();
  const create = useCreateBooking(hotelSlug);
  const [alert, setAlert] = useState<FormAlert | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(createBookingSchema),
    defaultValues: {
      roomTypeId: stay.roomTypeId,
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      guests: stay.guests,
      guestName: me?.name ?? "",
      guestEmail: me?.email ?? "",
      guestPhone: me?.phone ?? "",
    },
  });

  // Stays disabled after success too, until the redirect lands (no double hold)
  const busy = create.isPending || create.isSuccess;
  const backQuery = toSearchParams({ checkIn: stay.checkIn, checkOut: stay.checkOut, guests: stay.guests }).toString();
  const backHref = `/hotels/${encodeURIComponent(hotelSlug)}${backQuery ? `?${backQuery}` : ""}`;

  const onSubmit = handleSubmit((values) => {
    if (busy) return;
    setAlert(null);
    create.mutate(values, {
      onSuccess: (booking) => router.replace(`/account/bookings/${booking.code}`),
      onError: (error) => {
        if (error instanceof ApiError && error.code === "ROOM_UNAVAILABLE") {
          setAlert({ kind: "unavailable" });
        } else if (error instanceof ApiError && error.code === "CONFLICT") {
          setAlert({ kind: "conflict", message: error.message });
        } else if (
          !applyServerFieldErrors(error, setError, ["guestName", "guestEmail", "guestPhone"])
        ) {
          setAlert({ kind: "generic", message: formErrorMessage(error) });
        }
      },
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <h2 className="text-lg font-semibold">Guest details</h2>
      <input type="hidden" {...register("roomTypeId")} />
      <input type="hidden" {...register("checkIn")} />
      <input type="hidden" {...register("checkOut")} />
      <input type="hidden" {...register("guests")} />
      <div className="space-y-2">
        <Label htmlFor="guestName">Full name</Label>
        <Input
          id="guestName"
          autoComplete="name"
          aria-invalid={!!errors.guestName}
          aria-describedby={errors.guestName ? "guestName-error" : undefined}
          {...register("guestName")}
        />
        {errors.guestName && (
          <p id="guestName-error" className="text-sm text-destructive">{errors.guestName.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="guestEmail">Email</Label>
        <Input
          id="guestEmail"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.guestEmail}
          aria-describedby={errors.guestEmail ? "guestEmail-error" : undefined}
          {...register("guestEmail")}
        />
        {errors.guestEmail && (
          <p id="guestEmail-error" className="text-sm text-destructive">{errors.guestEmail.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="guestPhone">Phone (optional)</Label>
        <Input
          id="guestPhone"
          type="tel"
          autoComplete="tel"
          aria-invalid={!!errors.guestPhone}
          aria-describedby={errors.guestPhone ? "guestPhone-error" : undefined}
          {...register("guestPhone", {
            setValueAs: (v: string) => (v.trim() === "" ? undefined : v),
          })}
        />
        {errors.guestPhone && (
          <p id="guestPhone-error" className="text-sm text-destructive">{errors.guestPhone.message}</p>
        )}
      </div>
      {alert?.kind === "unavailable" && (
        <p role="alert" className="text-sm text-destructive">
          Someone just booked the last room for these dates.{" "}
          <Link href={backHref} className="underline underline-offset-4">
            Choose other dates or rooms
          </Link>
        </p>
      )}
      {alert?.kind === "conflict" && (
        <p role="alert" className="text-sm text-destructive">
          {alert.message}{" "}
          <Link href="/account/bookings" className="underline underline-offset-4">
            View my bookings
          </Link>
        </p>
      )}
      {alert?.kind === "generic" && (
        <p role="alert" className="text-sm text-destructive">
          {alert.message}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={busy || !canHold}>
        {busy ? "Holding…" : `Hold this room for ${HOLD_MINUTES} minutes`}
      </Button>
    </form>
  );
}

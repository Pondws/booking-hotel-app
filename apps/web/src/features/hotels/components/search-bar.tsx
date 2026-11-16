"use client";

import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, MapPin, Search, Users } from "lucide-react";
import type { z } from "zod";
import { hotelSearchQuerySchema, type HotelSearchQuery } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Input } from "@booking/ui/components/input";
import { Label } from "@booking/ui/components/label";
import { cn } from "@booking/ui/lib/utils";
import { thaiResolver } from "@/lib/messages-th";
import { searchHref } from "../search-params";
import { DateRangeField } from "./date-range-field";

type FormInput = z.input<typeof hotelSearchQuerySchema>;
type FormOutput = z.output<typeof hotelSearchQuerySchema>;

type Props = {
  /** Prefill (e.g. the current /hotels URL). */
  defaultValues?: Partial<HotelSearchQuery>;
  className?: string;
};

const LABEL = "flex items-center gap-1.5 text-xs font-medium text-muted-foreground";

export function SearchBar({ defaultValues, className }: Props) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitted, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: thaiResolver(zodResolver(hotelSearchQuerySchema)),
    defaultValues: {
      city: defaultValues?.city ?? "",
      checkIn: defaultValues?.checkIn,
      checkOut: defaultValues?.checkOut,
      guests: defaultValues?.guests ?? 1,
    },
  });
  const [checkIn, checkOut] = useWatch({ control, name: ["checkIn", "checkOut"] });

  // Every new search starts on page 1 (page/pageSize come from the schema defaults)
  const onSubmit = handleSubmit((values) => {
    router.push(searchHref({ ...values, page: 1, pageSize: defaultValues?.pageSize }));
  });

  const dateError = errors.checkIn?.message ?? errors.checkOut?.message;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      role="search"
      aria-label="ค้นหาที่พัก"
      className={cn(
        "grid gap-3 rounded-xl border bg-card p-3 text-card-foreground shadow-lg sm:grid-cols-2 lg:grid-cols-12 lg:items-start",
        className,
      )}
    >
      <div className="space-y-1.5 lg:col-span-4">
        <Label htmlFor="search-city" className={LABEL}>
          <MapPin aria-hidden className="size-4" />
          จุดหมายปลายทาง
        </Label>
        <Input
          id="search-city"
          placeholder="จะไปเมืองไหน เช่น Bangkok"
          autoComplete="address-level2"
          className="h-11"
          aria-invalid={!!errors.city}
          aria-describedby={errors.city ? "search-city-error" : undefined}
          {...register("city")}
        />
        {errors.city && (
          <p id="search-city-error" className="text-sm text-destructive">
            {errors.city.message}
          </p>
        )}
      </div>
      <div className="space-y-1.5 lg:col-span-4">
        <Label htmlFor="search-dates" className={LABEL}>
          <CalendarDays aria-hidden className="size-4" />
          เช็คอิน – เช็คเอาท์
        </Label>
        <DateRangeField
          id="search-dates"
          className="h-11"
          value={{ checkIn, checkOut }}
          invalid={!!dateError}
          describedBy={dateError ? "search-dates-error" : undefined}
          onChange={(next) => {
            const options = { shouldDirty: true, shouldValidate: isSubmitted };
            setValue("checkIn", next.checkIn, options);
            setValue("checkOut", next.checkOut, options);
          }}
        />
        {dateError && (
          <p id="search-dates-error" className="text-sm text-destructive">
            {dateError}
          </p>
        )}
      </div>
      <div className="space-y-1.5 lg:col-span-2">
        <Label htmlFor="search-guests" className={LABEL}>
          <Users aria-hidden className="size-4" />
          ผู้เข้าพัก
        </Label>
        <Input
          id="search-guests"
          type="number"
          inputMode="numeric"
          min={1}
          max={20}
          className="h-11"
          aria-invalid={!!errors.guests}
          aria-describedby={errors.guests ? "search-guests-error" : undefined}
          {...register("guests", { setValueAs: (v: unknown) => (v === "" ? undefined : v) })}
        />
        {errors.guests && (
          <p id="search-guests-error" className="text-sm text-destructive">
            {errors.guests.message}
          </p>
        )}
      </div>
      {/* Label-height spacer keeps the button aligned with the inputs on wide screens */}
      <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
        <span aria-hidden className="hidden text-xs leading-4 lg:block">
          &nbsp;
        </span>
        <Button type="submit" size="lg" className="h-11 w-full" disabled={isSubmitting}>
          <Search aria-hidden className="size-4" />
          {isSubmitting ? "กำลังค้นหา…" : "ค้นหา"}
        </Button>
      </div>
    </form>
  );
}

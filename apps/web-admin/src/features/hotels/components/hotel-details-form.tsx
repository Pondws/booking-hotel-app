"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { updateHotelSchema, type AdminHotel } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@booking/ui/components/card";
import { Input } from "@booking/ui/components/input";
import { Label } from "@booking/ui/components/label";
import { Textarea } from "@booking/ui/components/textarea";
import { applyServerFieldErrors, formErrorMessage } from "@/lib/form-errors";
import { useUpdateHotel } from "../hooks";

type FormInput = z.input<typeof updateHotelSchema>;
type FormOutput = z.output<typeof updateHotelSchema>;

const FIELDS = ["name", "city", "address", "description", "checkInTime", "checkOutTime"] as const;

function toFormValues(hotel: AdminHotel) {
  return {
    name: hotel.name,
    city: hotel.city,
    address: hotel.address,
    description: hotel.description ?? "",
    checkInTime: hotel.checkInTime,
    checkOutTime: hotel.checkOutTime,
  };
}

export function HotelDetailsForm({ hotel }: { hotel: AdminHotel }) {
  const mutation = useUpdateHotel(hotel.id);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(updateHotelSchema),
    defaultValues: toFormValues(hotel),
  });
  const hasFieldError = FIELDS.some((f) => errors[f]?.type === "server");

  const onSubmit = handleSubmit((values) => {
    mutation.reset();
    mutation.mutate(values, {
      onSuccess: (updated) => reset(toFormValues(updated)),
      onError: (error) => {
        applyServerFieldErrors(error, setError, FIELDS);
      },
    });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field id="name" label="Name" error={errors.name?.message}>
            <Input id="name" aria-invalid={!!errors.name} {...register("name")} />
          </Field>
          <Field id="city" label="City" error={errors.city?.message}>
            <Input id="city" aria-invalid={!!errors.city} {...register("city")} />
          </Field>
          <Field id="address" label="Address" error={errors.address?.message} className="sm:col-span-2">
            <Input id="address" aria-invalid={!!errors.address} {...register("address")} />
          </Field>
          <Field id="description" label="Description" error={errors.description?.message} className="sm:col-span-2">
            <Textarea id="description" aria-invalid={!!errors.description} {...register("description")} />
          </Field>
          <Field id="checkInTime" label="Check-in from" error={errors.checkInTime?.message}>
            <Input id="checkInTime" type="time" aria-invalid={!!errors.checkInTime} {...register("checkInTime")} />
          </Field>
          <Field id="checkOutTime" label="Check-out until" error={errors.checkOutTime?.message}>
            <Input
              id="checkOutTime"
              type="time"
              aria-invalid={!!errors.checkOutTime}
              {...register("checkOutTime")}
            />
          </Field>
          <div className="space-y-2 sm:col-span-2">
            {mutation.isError && !hasFieldError && (
              <p role="alert" className="text-sm text-destructive">
                {formErrorMessage(mutation.error)}
              </p>
            )}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={!isDirty || mutation.isPending}>
                {mutation.isPending ? "Saving…" : "Save details"}
              </Button>
              {mutation.isSuccess && !isDirty && <p className="text-sm text-muted-foreground">Saved</p>}
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function Field({
  id,
  label,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <div className="space-y-2">
        <Label htmlFor={id}>{label}</Label>
        {children}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}

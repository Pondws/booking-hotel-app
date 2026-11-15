"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { createHotelSchema } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@booking/ui/components/card";
import { Input } from "@booking/ui/components/input";
import { Label } from "@booking/ui/components/label";
import { Textarea } from "@booking/ui/components/textarea";
import { applyServerFieldErrors, formErrorMessage } from "@/lib/form-errors";
import { useCreateHotel } from "../hooks";

type FormInput = z.input<typeof createHotelSchema>;
type FormOutput = z.output<typeof createHotelSchema>;

const FIELDS = ["name", "city", "address", "description", "checkInTime", "checkOutTime"] as const;

export function CreateHotelForm() {
  const router = useRouter();
  const mutation = useCreateHotel();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(createHotelSchema),
    defaultValues: {
      name: "",
      city: "",
      address: "",
      description: "",
      checkInTime: "14:00",
      checkOutTime: "12:00",
    },
  });
  const hasFieldError = FIELDS.some((f) => errors[f]?.type === "server");

  const onSubmit = handleSubmit((values) => {
    mutation.reset();
    mutation.mutate(values, {
      onSuccess: (hotel) => router.push(`/hotels/${hotel.id}`),
      onError: (error) => {
        applyServerFieldErrors(error, setError, FIELDS);
      },
    });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hotel details</CardTitle>
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
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Creating…" : "Create hotel"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
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

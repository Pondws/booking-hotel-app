"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { createHotelSchema } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@booking/ui/components/card";
import { Input } from "@booking/ui/components/input";
import { Label } from "@booking/ui/components/label";
import { applyServerFieldErrors, formErrorMessage } from "@/lib/form-errors";
import { useCreateHotel } from "../hooks";

type FormInput = z.input<typeof createHotelSchema>;
type FormOutput = z.output<typeof createHotelSchema>;

const FIELDS = ["name", "city", "address", "description"] as const;

export function CreateHotelForm() {
  const mutation = useCreateHotel();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(createHotelSchema),
    defaultValues: { name: "", city: "", address: "", description: "" },
  });
  const hasFieldError = FIELDS.some((f) => errors[f]?.type === "server");

  const onSubmit = handleSubmit((values) => {
    mutation.reset();
    mutation.mutate(values, {
      onSuccess: () => reset(),
      onError: (error) => {
        applyServerFieldErrors(error, setError, FIELDS);
      },
    });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add hotel</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field id="name" label="Name" error={errors.name?.message} {...register("name")} />
          <Field id="city" label="City" error={errors.city?.message} {...register("city")} />
          <Field id="address" label="Address" error={errors.address?.message} {...register("address")} />
          <Field
            id="description"
            label="Description"
            error={errors.description?.message}
            {...register("description")}
          />
          <div className="flex items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Create hotel"}
            </Button>
            {mutation.isError && !hasFieldError && (
              <p role="alert" className="text-sm text-destructive">
                {formErrorMessage(mutation.error)}
              </p>
            )}
            {mutation.isSuccess && <p className="text-sm text-muted-foreground">Saved.</p>}
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
  ...props
}: { id: string; label: string; error?: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-invalid={!!error} {...props} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

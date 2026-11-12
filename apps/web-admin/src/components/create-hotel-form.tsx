"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createHotelSchema, hotelSchema, type CreateHotelInput } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@booking/ui/components/card";
import { Input } from "@booking/ui/components/input";
import { Label } from "@booking/ui/components/label";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/hooks/use-hotels";

type FieldErrors = Partial<Record<keyof CreateHotelInput, string[]>>;

export function CreateHotelForm() {
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState<FieldErrors>({});

  const mutation = useMutation({
    mutationFn: (input: CreateHotelInput) =>
      apiFetch("/api/hotels", hotelSchema, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.hotels }),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const raw = Object.fromEntries(new FormData(form));
    // Validate on the client with the same schema the API uses
    const parsed = createHotelSchema.safeParse({ ...raw, description: raw.description || undefined });
    if (!parsed.success) {
      setErrors(z.flattenError(parsed.error).fieldErrors);
      return;
    }
    setErrors({});
    mutation.mutate(parsed.data, { onSuccess: () => form.reset() });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add hotel</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field name="name" label="Name" error={errors.name} />
          <Field name="city" label="City" error={errors.city} />
          <Field name="address" label="Address" error={errors.address} />
          <Field name="description" label="Description" error={errors.description} />
          <div className="flex items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Create hotel"}
            </Button>
            {mutation.isError && <p className="text-destructive text-sm">{mutation.error.message}</p>}
            {mutation.isSuccess && <p className="text-muted-foreground text-sm">Saved.</p>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  name,
  label,
  error,
  ...props
}: { name: string; label: string; error?: string[] } & React.ComponentProps<typeof Input>) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} aria-invalid={!!error} {...props} />
      {error && <p className="text-destructive text-xs">{error[0]}</p>}
    </div>
  );
}

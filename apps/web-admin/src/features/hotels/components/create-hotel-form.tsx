"use client";

import { createHotelSchema, type CreateHotelInput } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@booking/ui/components/card";
import { Input } from "@booking/ui/components/input";
import { Label } from "@booking/ui/components/label";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { ApiError } from "@/lib/api";
import { useCreateHotel } from "../hooks";

type FieldErrors = Partial<Record<keyof CreateHotelInput, string[]>>;

const fieldErrorsDetailsSchema = z.object({
  fieldErrors: z.record(z.string(), z.array(z.string())),
});

/** Maps API VALIDATION_FAILED details onto the form's field errors, or null if not applicable. */
function serverFieldErrors(error: unknown): FieldErrors | null {
  if (!(error instanceof ApiError) || error.code !== "VALIDATION_FAILED") return null;
  const parsed = fieldErrorsDetailsSchema.safeParse(error.details);
  if (!parsed.success) return null;
  const result: FieldErrors = {};
  for (const key of createHotelSchema.keyof().options) {
    const messages = parsed.data.fieldErrors[key];
    if (messages) result[key] = messages;
  }
  return result;
}

export function CreateHotelForm() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const mutation = useCreateHotel();

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
    mutation.mutate(parsed.data, {
      onSuccess: () => form.reset(),
      onError: (error) => {
        const fieldErrors = serverFieldErrors(error);
        if (fieldErrors) setErrors(fieldErrors);
      },
    });
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
            {mutation.isError && !serverFieldErrors(mutation.error) && (
              <p className="text-destructive text-sm">{mutation.error.message}</p>
            )}
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

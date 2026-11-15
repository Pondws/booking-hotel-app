"use client";

import { Controller, useForm } from "react-hook-form";
import type { AdminHotel, AmenityOption } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@booking/ui/components/card";
import { Checkbox } from "@booking/ui/components/checkbox";
import { Label } from "@booking/ui/components/label";
import { Skeleton } from "@booking/ui/components/skeleton";
import { useAmenities } from "@/features/amenities/hooks";
import { applyServerFieldErrors, formErrorMessage } from "@/lib/form-errors";
import { useReplaceHotelAmenities } from "../hooks";

type FormValues = { amenityIds: string[] };

export function HotelAmenitiesForm({ hotel }: { hotel: AdminHotel }) {
  const options = useAmenities("HOTEL");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Amenities</CardTitle>
      </CardHeader>
      <CardContent>
        {options.isPending ? (
          <div className="grid gap-3 sm:grid-cols-2" aria-hidden>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-5 w-40" />
            ))}
          </div>
        ) : options.isError ? (
          <div role="alert" className="space-y-2">
            <p className="text-sm">Couldn&apos;t load amenities.</p>
            <Button variant="outline" onClick={() => void options.refetch()}>
              Try again
            </Button>
          </div>
        ) : options.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hotel amenities in the catalog</p>
        ) : (
          <AmenitiesChecklist hotel={hotel} options={options.data} />
        )}
      </CardContent>
    </Card>
  );
}

function AmenitiesChecklist({ hotel, options }: { hotel: AdminHotel; options: AmenityOption[] }) {
  const mutation = useReplaceHotelAmenities(hotel.id);
  // Keep ids in catalog order so toggling a box off and on again isn't "dirty"
  const ordered = (ids: Iterable<string>) => {
    const set = new Set(ids);
    return options.filter((o) => set.has(o.id)).map((o) => o.id);
  };
  const toFormValues = (h: AdminHotel): FormValues => ({ amenityIds: ordered(h.amenities.map((a) => a.id)) });
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<FormValues>({ defaultValues: toFormValues(hotel) });

  const onSubmit = handleSubmit((values) => {
    mutation.reset();
    mutation.mutate(values, {
      onSuccess: (updated) => reset(toFormValues(updated)),
      onError: (error) => {
        applyServerFieldErrors(error, setError, ["amenityIds"]);
      },
    });
  });
  const serverMessage = errors.amenityIds?.message;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Controller
        control={control}
        name="amenityIds"
        render={({ field }) => (
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="sr-only">Hotel amenities</legend>
            {options.map((option) => {
              const id = `amenity-${option.id}`;
              const checked = field.value.includes(option.id);
              return (
                <div key={option.id} className="flex items-center gap-2">
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={(next) => {
                      const ids = new Set(field.value);
                      if (next === true) ids.add(option.id);
                      else ids.delete(option.id);
                      field.onChange(ordered(ids));
                    }}
                  />
                  <Label htmlFor={id} className="font-normal">
                    {option.name}
                  </Label>
                </div>
              );
            })}
          </fieldset>
        )}
      />
      {(serverMessage || (mutation.isError && !serverMessage)) && (
        <p role="alert" className="text-sm text-destructive">
          {serverMessage ?? formErrorMessage(mutation.error)}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!isDirty || mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save amenities"}
        </Button>
        {mutation.isSuccess && !isDirty && <p className="text-sm text-muted-foreground">Saved</p>}
      </div>
    </form>
  );
}

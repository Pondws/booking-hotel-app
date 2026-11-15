"use client";

import { Controller, useFormContext } from "react-hook-form";
import type { AmenityOption, AmenityScope } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@booking/ui/components/card";
import { Checkbox } from "@booking/ui/components/checkbox";
import { Label } from "@booking/ui/components/label";
import { Skeleton } from "@booking/ui/components/skeleton";
import { useAmenities } from "../hooks";

/** The slice of a form this section edits. */
type AmenitiesForm = { amenityIds: string[] };

const LABELS: Record<AmenityScope, { legend: string; empty: string }> = {
  HOTEL: { legend: "สิ่งอำนวยความสะดวกของโรงแรม", empty: "ยังไม่มีสิ่งอำนวยความสะดวกของโรงแรมในระบบ" },
  ROOM: { legend: "สิ่งอำนวยความสะดวกของห้อง", empty: "ยังไม่มีสิ่งอำนวยความสะดวกของห้องในระบบ" },
};

/** Checkboxes of the catalog amenities in `scope` — must be rendered inside a `FormProvider`. */
export function AmenitiesSection({ scope }: { scope: AmenityScope }) {
  const {
    formState: { errors },
  } = useFormContext<AmenitiesForm>();
  const options = useAmenities(scope);
  return (
    <Card>
      <CardHeader>
        <CardTitle>สิ่งอำนวยความสะดวก</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {options.isPending ? (
          <div className="grid gap-3 sm:grid-cols-2" aria-hidden>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-5 w-40" />
            ))}
          </div>
        ) : options.isError ? (
          <div role="alert" className="space-y-2">
            <p className="text-sm">โหลดรายการสิ่งอำนวยความสะดวกไม่สำเร็จ</p>
            <Button type="button" variant="outline" onClick={() => void options.refetch()}>
              ลองอีกครั้ง
            </Button>
          </div>
        ) : options.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{LABELS[scope].empty}</p>
        ) : (
          <AmenityCheckboxes options={options.data} legend={LABELS[scope].legend} />
        )}
        {errors.amenityIds?.message && (
          <p className="text-sm text-destructive">{errors.amenityIds.message}</p>
        )}
      </CardContent>
    </Card>
  );
}

function AmenityCheckboxes({ options, legend }: { options: AmenityOption[]; legend: string }) {
  const { control } = useFormContext<AmenitiesForm>();
  return (
    <Controller
      control={control}
      name="amenityIds"
      render={({ field }) => (
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">{legend}</legend>
          {options.map((option) => {
            const id = `amenity-${option.id}`;
            return (
              <div key={option.id} className="flex items-center gap-2">
                <Checkbox
                  id={id}
                  checked={field.value.includes(option.id)}
                  onCheckedChange={(next) => {
                    const ids = new Set(field.value);
                    if (next === true) ids.add(option.id);
                    else ids.delete(option.id);
                    // Keep catalog (name) order, so toggling off and on again isn't "dirty"
                    field.onChange(options.filter((o) => ids.has(o.id)).map((o) => o.id));
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
  );
}

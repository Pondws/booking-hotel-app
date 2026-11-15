"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ratePeriodInputSchema,
  type AdminRatePeriod,
  type RatePeriodData,
  type RatePeriodInput,
} from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Input } from "@booking/ui/components/input";
import { Field } from "@/components/form-field";
import { applyServerFieldErrors, formErrorMessage } from "@/lib/form-errors";
import { useCreateRatePeriod, useUpdateRatePeriod } from "../hooks";
import { PeriodRangeField } from "./period-range-field";

const FIELDS = ["name", "startDate", "endDate", "price"] as const;

type Props = {
  hotelId: string;
  roomTypeId: string;
  currency: string;
  /** Edit this period; create a new one when omitted. */
  period?: AdminRatePeriod;
  onDone: () => void;
};

export function RatePeriodForm({ hotelId, roomTypeId, currency, period, onDone }: Props) {
  const create = useCreateRatePeriod(hotelId, roomTypeId);
  const update = useUpdateRatePeriod(hotelId, roomTypeId, period?.id ?? "");
  const mutation = period ? update : create;
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitted },
  } = useForm<RatePeriodInput, unknown, RatePeriodData>({
    resolver: zodResolver(ratePeriodInputSchema),
    defaultValues: period
      ? { name: period.name ?? "", startDate: period.startDate, endDate: period.endDate, price: period.price }
      : { name: "", startDate: "", endDate: "" },
  });
  const [startDate, endDate] = useWatch({ control, name: ["startDate", "endDate"] });
  const datesError = errors.startDate?.message ?? errors.endDate?.message;
  // A field-level server error is shown on its field; anything else (e.g. an overlap 409) under the form
  const formError =
    mutation.isError && !Object.keys(errors).length ? formErrorMessage(mutation.error) : undefined;

  return (
    <form
      noValidate
      aria-label={period ? "Edit rate period" : "New rate period"}
      className="space-y-4 rounded-lg border p-4"
      onSubmit={handleSubmit((data) =>
        mutation.mutate(data, {
          onSuccess: onDone,
          onError: (err) => applyServerFieldErrors(err, setError, FIELDS),
        }),
      )}
    >
      <p className="font-medium">{period ? "Edit rate period" : "New rate period"}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="rate-name" label="Name (optional)" error={errors.name?.message}>
          <Input
            id="rate-name"
            placeholder="e.g. High season"
            aria-invalid={!!errors.name}
            {...register("name", { onChange: () => mutation.reset() })}
          />
        </Field>
        <Field id="rate-price" label={`Price per night (${currency})`} error={errors.price?.message}>
          <Input
            id="rate-price"
            type="number"
            inputMode="decimal"
            min={0}
            step={0.01}
            aria-invalid={!!errors.price}
            {...register("price", { valueAsNumber: true, onChange: () => mutation.reset() })}
          />
        </Field>
        <Field id="rate-dates" label="Nights" error={datesError} className="sm:col-span-2">
          <PeriodRangeField
            id="rate-dates"
            invalid={!!datesError}
            describedBy="rate-dates-hint"
            value={{ startDate, endDate }}
            onChange={(next) => {
              mutation.reset();
              const options = { shouldDirty: true, shouldValidate: isSubmitted };
              setValue("startDate", next.startDate, options);
              setValue("endDate", next.endDate, options);
            }}
          />
          <p id="rate-dates-hint" className="text-sm text-muted-foreground">
            Pick the first night, then the day the price ends — like check-in and check-out. That night is
            back at the base price.
          </p>
        </Field>
      </div>
      {formError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {formError}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : period ? "Save" : "Add rate period"}
        </Button>
        <Button type="button" variant="ghost" disabled={mutation.isPending} onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

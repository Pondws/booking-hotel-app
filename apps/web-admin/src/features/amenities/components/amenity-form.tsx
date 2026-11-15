"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createAmenitySchema,
  type AdminAmenity,
  type CreateAmenityData,
  type CreateAmenityInput,
} from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Input } from "@booking/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@booking/ui/components/select";
import { Field } from "@/components/form-field";
import { applyServerFieldErrors, formErrorMessage } from "@/lib/form-errors";
import { thaiResolver } from "@/lib/messages-th";
import { useCreateAmenity, useUpdateAmenity } from "../hooks";
import { SCOPE_LABEL } from "./scope-label";

const FIELDS = ["code", "name", "scope"] as const;

type Props = {
  /** Edit this amenity (scope stays fixed); create a new one when omitted. */
  amenity?: AdminAmenity;
  onDone: () => void;
};

export function AmenityForm({ amenity, onDone }: Props) {
  const create = useCreateAmenity();
  const update = useUpdateAmenity(amenity?.id ?? "");
  const mutation = amenity ? update : create;
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CreateAmenityInput, unknown, CreateAmenityData>({
    // Edit sends the same shape; the API ignores scope there
    resolver: thaiResolver(zodResolver(createAmenitySchema)),
    defaultValues: amenity
      ? { code: amenity.code, name: amenity.name, scope: amenity.scope }
      : { code: "", name: "", scope: "HOTEL" },
  });
  const formError =
    mutation.isError && !Object.keys(errors).length ? formErrorMessage(mutation.error) : undefined;
  const title = amenity ? `แก้ไข ${amenity.name}` : "เพิ่มสิ่งอำนวยความสะดวก";

  return (
    <form
      noValidate
      aria-label={title}
      className="space-y-4 rounded-lg border p-4"
      onSubmit={handleSubmit((data) => {
        // A duplicate code is a 409 with fieldErrors — shown under the field
        const onError = (err: unknown) => applyServerFieldErrors(err, setError, FIELDS);
        if (amenity) update.mutate({ code: data.code, name: data.name }, { onSuccess: onDone, onError });
        else create.mutate(data, { onSuccess: onDone, onError });
      })}
    >
      <p className="font-medium">{title}</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="amenity-name" label="ชื่อ" error={errors.name?.message}>
          <Input
            id="amenity-name"
            placeholder="เช่น Fitness center"
            aria-invalid={!!errors.name}
            {...register("name", { onChange: () => mutation.reset() })}
          />
        </Field>
        <Field id="amenity-code" label="รหัส" error={errors.code?.message}>
          <Input
            id="amenity-code"
            placeholder="เช่น fitness"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={!!errors.code}
            aria-describedby="amenity-code-hint"
            {...register("code", { onChange: () => mutation.reset() })}
          />
          <p id="amenity-code-hint" className="text-sm text-muted-foreground">
            ตัวพิมพ์เล็ก ตัวเลข - และ _ ใช้เลือกไอคอนบนเว็บลูกค้า
          </p>
        </Field>
        <Field id="amenity-scope" label="ใช้กับ" error={errors.scope?.message}>
          <Controller
            control={control}
            name="scope"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={amenity !== undefined}>
                <SelectTrigger id="amenity-scope" className="w-full" aria-describedby="amenity-scope-hint">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOTEL">{SCOPE_LABEL.HOTEL}</SelectItem>
                  <SelectItem value="ROOM">{SCOPE_LABEL.ROOM}</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {amenity && (
            <p id="amenity-scope-hint" className="text-sm text-muted-foreground">
              เปลี่ยนหลังสร้างแล้วไม่ได้
            </p>
          )}
        </Field>
      </div>
      {formError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {formError}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "กำลังบันทึก…" : amenity ? "บันทึก" : "เพิ่ม"}
        </Button>
        <Button type="button" variant="ghost" disabled={mutation.isPending} onClick={onDone}>
          ยกเลิก
        </Button>
      </div>
    </form>
  );
}

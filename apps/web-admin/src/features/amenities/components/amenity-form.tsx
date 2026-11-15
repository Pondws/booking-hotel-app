"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createAmenitySchema,
  type AdminAmenity,
  type CreateAmenityData,
  type CreateAmenityInput,
} from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@booking/ui/components/card";
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

const toValues = (a: AdminAmenity): CreateAmenityInput => ({ code: a.code, name: a.name, scope: a.scope });

/** Edit `amenity` (scope stays fixed), or create one and open its page when omitted. */
export function AmenityForm({ amenity }: { amenity?: AdminAmenity }) {
  const router = useRouter();
  const create = useCreateAmenity();
  const update = useUpdateAmenity(amenity?.id ?? "");
  const mutation = amenity ? update : create;
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<CreateAmenityInput, unknown, CreateAmenityData>({
    // Edit sends the same shape; the API ignores scope there
    resolver: thaiResolver(zodResolver(createAmenitySchema)),
    defaultValues: amenity ? toValues(amenity) : { code: "", name: "", scope: "HOTEL" },
  });
  const formError =
    mutation.isError && !Object.keys(errors).length ? formErrorMessage(mutation.error) : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{amenity ? "ข้อมูลสิ่งอำนวยความสะดวก" : "สิ่งอำนวยความสะดวกใหม่"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          aria-label={amenity ? "ข้อมูลสิ่งอำนวยความสะดวก" : "เพิ่มสิ่งอำนวยความสะดวก"}
          className="space-y-4"
          onSubmit={handleSubmit((data) => {
            // A duplicate code is a 409 with fieldErrors — shown under the field
            const onError = (err: unknown) => applyServerFieldErrors(err, setError, FIELDS);
            if (amenity) {
              update.mutate(
                { code: data.code, name: data.name },
                { onSuccess: (saved) => reset(toValues(saved)), onError },
              );
            } else {
              create.mutate(data, { onSuccess: (created) => router.push(`/amenities/${created.id}`), onError });
            }
          })}
        >
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
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={mutation.isPending || (amenity !== undefined && !isDirty)}>
              {mutation.isPending ? "กำลังบันทึก…" : amenity ? "บันทึก" : "เพิ่ม"}
            </Button>
            {amenity ? (
              <Button type="button" variant="ghost" disabled={mutation.isPending || !isDirty} onClick={() => reset()}>
                ยกเลิกการแก้ไข
              </Button>
            ) : (
              <Button asChild variant="ghost">
                <Link href="/amenities">ยกเลิก</Link>
              </Button>
            )}
            <p role="status" className="text-sm text-muted-foreground">
              {amenity && update.isSuccess && !isDirty ? "บันทึกแล้ว" : ""}
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

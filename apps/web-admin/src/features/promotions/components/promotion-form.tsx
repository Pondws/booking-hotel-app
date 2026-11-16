"use client";

import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  PROMOTION_TYPES,
  promotionInputSchema,
  type AdminPromotion,
  type PromotionData,
  type PromotionInput,
} from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Checkbox } from "@booking/ui/components/checkbox";
import { Input } from "@booking/ui/components/input";
import { Label } from "@booking/ui/components/label";
import { SelectField } from "@booking/ui/components/select-field";
import { Field } from "@/components/form-field";
import { applyServerFieldErrors, formErrorMessage } from "@/lib/form-errors";
import { thaiResolver } from "@/lib/messages-th";
import { useCreatePromotion, useUpdatePromotion } from "../hooks";
import { PROMOTION_TYPE_HINT, PROMOTION_TYPE_LABEL } from "./promotion-type-label";

const FIELDS = [
  "name",
  "type",
  "percentOff",
  "minNights",
  "minDaysAhead",
  "maxDaysAhead",
  "code",
  "validFrom",
  "validUntil",
] as const;

const TYPE_OPTIONS = PROMOTION_TYPES.map((value) => ({ value, label: PROMOTION_TYPE_LABEL[value] }));

/** Empty number box → null (the condition is off). */
const optionalNumber = (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v));

type Props = {
  hotelId: string;
  /** Edit this promotion; create a new one when omitted. */
  promotion?: AdminPromotion;
  onDone: () => void;
};

export function PromotionForm({ hotelId, promotion, onDone }: Props) {
  const create = useCreatePromotion(hotelId);
  const update = useUpdatePromotion(hotelId, promotion?.id ?? "");
  const mutation = promotion ? update : create;
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<PromotionInput, unknown, PromotionData>({
    resolver: thaiResolver(zodResolver(promotionInputSchema)),
    defaultValues: promotion
      ? {
          name: promotion.name,
          type: promotion.type,
          percentOff: promotion.percentOff,
          minNights: promotion.minNights,
          minDaysAhead: promotion.minDaysAhead,
          maxDaysAhead: promotion.maxDaysAhead,
          code: promotion.code ?? "",
          validFrom: promotion.validFrom ?? "",
          validUntil: promotion.validUntil ?? "",
          isActive: promotion.isActive,
        }
      : {
          name: "",
          type: "EARLY_BIRD",
          minNights: 1,
          minDaysAhead: null,
          maxDaysAhead: null,
          code: "",
          validFrom: "",
          validUntil: "",
          isActive: true,
        },
  });
  const type = useWatch({ control, name: "type" });
  const formError =
    mutation.isError && !Object.keys(errors).length ? formErrorMessage(mutation.error) : undefined;
  const reset = () => mutation.reset();

  return (
    <form
      noValidate
      aria-label={promotion ? "แก้ไขโปรโมชัน" : "เพิ่มโปรโมชัน"}
      className="space-y-4 rounded-lg border p-4"
      onSubmit={handleSubmit((data) =>
        mutation.mutate(data, {
          onSuccess: onDone,
          onError: (err) => applyServerFieldErrors(err, setError, FIELDS),
        }),
      )}
    >
      <p className="font-medium">{promotion ? "แก้ไขโปรโมชัน" : "เพิ่มโปรโมชัน"}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="promo-name" label="ชื่อที่ลูกค้าเห็น" error={errors.name?.message}>
          <Input
            id="promo-name"
            placeholder="เช่น จองล่วงหน้า 30 วัน"
            aria-invalid={!!errors.name}
            {...register("name", { onChange: reset })}
          />
        </Field>
        <Field id="promo-type" label="ประเภท" error={errors.type?.message}>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <SelectField
                id="promo-type"
                className="w-full"
                aria-describedby="promo-type-hint"
                options={TYPE_OPTIONS}
                value={field.value}
                onValueChange={(v) => {
                  reset();
                  field.onChange(v);
                }}
              />
            )}
          />
          <p id="promo-type-hint" className="text-sm text-muted-foreground">
            {PROMOTION_TYPE_HINT[type]}
          </p>
        </Field>
        <Field id="promo-percent" label="ส่วนลด (%)" error={errors.percentOff?.message}>
          <Input
            id="promo-percent"
            type="number"
            inputMode="numeric"
            min={1}
            max={90}
            aria-invalid={!!errors.percentOff}
            {...register("percentOff", { valueAsNumber: true, onChange: reset })}
          />
        </Field>
        {type === "CODE" && (
          <Field id="promo-code" label="โค้ด" error={errors.code?.message}>
            <Input
              id="promo-code"
              autoComplete="off"
              className="uppercase"
              aria-invalid={!!errors.code}
              {...register("code", { onChange: reset })}
            />
          </Field>
        )}
        <Field id="promo-min-nights" label="จำนวนคืนขั้นต่ำ" error={errors.minNights?.message}>
          <Input
            id="promo-min-nights"
            type="number"
            inputMode="numeric"
            min={1}
            aria-invalid={!!errors.minNights}
            {...register("minNights", { valueAsNumber: true, onChange: reset })}
          />
        </Field>
        <Field
          id="promo-min-days"
          label={type === "EARLY_BIRD" ? "จองล่วงหน้าอย่างน้อย (วัน)" : "จองล่วงหน้าอย่างน้อย (วัน, ไม่บังคับ)"}
          error={errors.minDaysAhead?.message}
        >
          <Input
            id="promo-min-days"
            type="number"
            inputMode="numeric"
            min={1}
            aria-invalid={!!errors.minDaysAhead}
            {...register("minDaysAhead", { setValueAs: optionalNumber, onChange: reset })}
          />
        </Field>
        <Field
          id="promo-max-days"
          label={type === "LAST_MINUTE" ? "เข้าพักภายใน (วัน)" : "เข้าพักภายใน (วัน, ไม่บังคับ)"}
          error={errors.maxDaysAhead?.message}
        >
          <Input
            id="promo-max-days"
            type="number"
            inputMode="numeric"
            min={0}
            aria-invalid={!!errors.maxDaysAhead}
            {...register("maxDaysAhead", { setValueAs: optionalNumber, onChange: reset })}
          />
        </Field>
        <Field id="promo-valid-from" label="จองได้ตั้งแต่ (ไม่บังคับ)" error={errors.validFrom?.message}>
          <Input
            id="promo-valid-from"
            type="date"
            aria-invalid={!!errors.validFrom}
            {...register("validFrom", { onChange: reset })}
          />
        </Field>
        <Field id="promo-valid-until" label="จองได้ถึง (ไม่บังคับ)" error={errors.validUntil?.message}>
          <Input
            id="promo-valid-until"
            type="date"
            aria-invalid={!!errors.validUntil}
            {...register("validUntil", { onChange: reset })}
          />
        </Field>
        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <div className="flex items-center gap-2 sm:col-span-2">
              <Checkbox
                id="promo-active"
                checked={field.value ?? true}
                onCheckedChange={(checked) => {
                  reset();
                  field.onChange(checked === true);
                }}
              />
              <Label htmlFor="promo-active">เปิดใช้งาน</Label>
            </div>
          )}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        ใช้ได้ครั้งละ 1 ดีล ระบบเลือกดีลที่ลดมากที่สุดให้ลูกค้าเอง การจองที่มีอยู่ใช้ราคาเดิม
      </p>
      {formError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {formError}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "กำลังบันทึก…" : promotion ? "บันทึก" : "เพิ่มโปรโมชัน"}
        </Button>
        <Button type="button" variant="ghost" disabled={mutation.isPending} onClick={onDone}>
          ยกเลิก
        </Button>
      </div>
    </form>
  );
}

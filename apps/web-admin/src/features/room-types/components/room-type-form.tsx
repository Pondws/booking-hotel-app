"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { FormProvider, useForm, useFormContext, type DefaultValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { ROOM_TYPE_MAX_CAPACITY, roomTypeInputSchema, type AdminRoomType } from "@booking/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@booking/ui/components/card";
import { Input } from "@booking/ui/components/input";
import { Textarea } from "@booking/ui/components/textarea";
import { Field } from "@/components/form-field";
import { FormHeader } from "@/components/form-header";
import { AmenitiesSection } from "@/features/amenities/components/amenities-field";
import { ImagesSection } from "@/features/uploads/components/images-field";
import { applyServerFieldErrors } from "@/lib/form-errors";
import { thaiResolver } from "@/lib/messages-th";
import { useCreateRoomType, useSaveRoomType } from "../hooks";

type FormInput = z.input<typeof roomTypeInputSchema>;
type FormOutput = z.output<typeof roomTypeInputSchema>;

const FIELDS = ["name", "description", "capacity", "basePrice", "images", "amenityIds"] as const;

// No price yet: the empty number input fails validation with "Enter a price" (shown in Thai)
const EMPTY_VALUES: DefaultValues<FormInput> = {
  name: "",
  description: "",
  capacity: 2,
  images: [],
  amenityIds: [],
};

function toFormValues(roomType: AdminRoomType): FormInput {
  return {
    name: roomType.name,
    description: roomType.description ?? "",
    capacity: roomType.capacity,
    basePrice: roomType.basePrice,
    images: roomType.images.map((img) => ({ url: img.url, alt: img.alt ?? "" })),
    amenityIds: roomType.amenities.map((a) => a.id),
  };
}

type RoomTypeFormProps = {
  hotelId: string;
  /** Shown next to the price. */
  currency: string;
  /** Edit this room type; without it the form creates one and opens its page. */
  roomType?: AdminRoomType;
  heading: ReactNode;
  actions?: ReactNode;
};

/** Details, images and room amenities of one room type — one submit, saved atomically by the API. */
export function RoomTypeForm({ hotelId, currency, roomType, heading, actions }: RoomTypeFormProps) {
  const router = useRouter();
  const create = useCreateRoomType(hotelId);
  const save = useSaveRoomType(hotelId, roomType?.id ?? "");
  const isCreate = roomType === undefined;
  const mutation = isCreate ? create : save;
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: thaiResolver(zodResolver(roomTypeInputSchema)),
    defaultValues: roomType ? toFormValues(roomType) : EMPTY_VALUES,
  });
  const {
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = form;
  const hasFieldError = FIELDS.some((f) => errors[f]?.type === "server");

  const onSubmit = handleSubmit((values) => {
    mutation.reset();
    const input = {
      ...values,
      images: values.images.map(({ url, alt }) => ({ url, ...(alt ? { alt } : {}) })),
    };
    const onError = (error: unknown) => {
      applyServerFieldErrors(error, setError, FIELDS);
    };
    if (isCreate) {
      create.mutate(input, {
        onSuccess: (created) => router.push(`/hotels/${hotelId}/room-types/${created.id}`),
        onError,
      });
    } else {
      save.mutate(input, { onSuccess: (updated) => reset(toFormValues(updated)), onError });
    }
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="space-y-6">
        <FormHeader
          heading={heading}
          actions={actions}
          backHref={`/hotels/${hotelId}`}
          isCreate={isCreate}
          createLabel="สร้างประเภทห้อง"
          isDirty={isDirty}
          isPending={mutation.isPending}
          isSuccess={mutation.isSuccess}
          error={mutation.error}
          hasFieldError={hasFieldError}
          onDiscard={() => reset()}
        />
        <DetailsSection currency={currency} />
        <ImagesSection />
        <AmenitiesSection scope="ROOM" />
      </form>
    </FormProvider>
  );
}

function DetailsSection({ currency }: { currency: string }) {
  const {
    register,
    formState: { errors },
  } = useFormContext<FormInput>();
  return (
    <Card>
      <CardHeader>
        <CardTitle>รายละเอียด</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Field id="name" label="ชื่อ" error={errors.name?.message} className="sm:col-span-2">
          <Input id="name" aria-invalid={!!errors.name} {...register("name")} />
        </Field>
        <Field id="capacity" label="จำนวนผู้เข้าพักสูงสุด" error={errors.capacity?.message}>
          <Input
            id="capacity"
            type="number"
            inputMode="numeric"
            min={1}
            max={ROOM_TYPE_MAX_CAPACITY}
            step={1}
            aria-invalid={!!errors.capacity}
            {...register("capacity", { valueAsNumber: true })}
          />
        </Field>
        <Field id="basePrice" label={`ราคาพื้นฐานต่อคืน (${currency})`} error={errors.basePrice?.message}>
          <Input
            id="basePrice"
            type="number"
            inputMode="decimal"
            min={0}
            step={0.01}
            aria-invalid={!!errors.basePrice}
            {...register("basePrice", { valueAsNumber: true })}
          />
        </Field>
        <Field
          id="description"
          label="คำอธิบาย"
          error={errors.description?.message}
          className="sm:col-span-2"
        >
          <Textarea id="description" aria-invalid={!!errors.description} {...register("description")} />
        </Field>
      </CardContent>
    </Card>
  );
}

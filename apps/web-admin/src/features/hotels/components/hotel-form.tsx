"use client";

import { useRouter } from "next/navigation";
import { useId, type ReactNode } from "react";
import { FormProvider, useForm, useFormContext } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { hotelContentInputSchema, type AdminHotel } from "@booking/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@booking/ui/components/card";
import { Input } from "@booking/ui/components/input";
import { Textarea } from "@booking/ui/components/textarea";
import { Field } from "@/components/form-field";
import { DetailsPanel } from "@/components/detail-tabs";
import { FormHeader } from "@/components/form-header";
import { AmenitiesSection } from "@/features/amenities/components/amenities-field";
import { ImagesSection } from "@/features/uploads/components/images-field";
import { applyServerFieldErrors } from "@/lib/form-errors";
import { thaiResolver } from "@/lib/messages-th";
import { useCreateHotel, useSaveHotel } from "../hooks";

type FormInput = z.input<typeof hotelContentInputSchema>;
type FormOutput = z.output<typeof hotelContentInputSchema>;

const FIELDS = [
  "name",
  "city",
  "address",
  "description",
  "checkInTime",
  "checkOutTime",
  "images",
  "amenityIds",
] as const;

const EMPTY_VALUES: FormInput = {
  name: "",
  city: "",
  address: "",
  description: "",
  checkInTime: "14:00",
  checkOutTime: "12:00",
  images: [],
  amenityIds: [],
};

function toFormValues(hotel: AdminHotel): FormInput {
  return {
    name: hotel.name,
    city: hotel.city,
    address: hotel.address,
    description: hotel.description ?? "",
    checkInTime: hotel.checkInTime,
    checkOutTime: hotel.checkOutTime,
    images: hotel.images.map((img) => ({ url: img.url, alt: img.alt ?? "" })),
    // Both lists are ordered by amenity name, so toggling a box off and on again isn't "dirty"
    amenityIds: hotel.amenities.map((a) => a.id),
  };
}

type HotelFormProps = {
  /** Edit this hotel; without it the form creates a new one (ADMIN) and opens its page. */
  hotel?: AdminHotel;
  /** Left side of the header (page title, status…). */
  heading: ReactNode;
  /** `DetailTabsList` for the header — the page wraps everything in `DetailTabs`. Create mode has none. */
  tabs?: ReactNode;
  /** More details-tab content after the form (cards with their own forms, so outside this `<form>`). */
  children?: ReactNode;
};

/** Details, times, images and amenities of one hotel — one form, one submit, saved atomically by the API. */
export function HotelForm({ hotel, heading, tabs, children }: HotelFormProps) {
  const router = useRouter();
  const formId = useId();
  const create = useCreateHotel();
  const save = useSaveHotel(hotel?.id ?? "");
  const isCreate = hotel === undefined;
  const mutation = isCreate ? create : save;
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: thaiResolver(zodResolver(hotelContentInputSchema)),
    defaultValues: hotel ? toFormValues(hotel) : EMPTY_VALUES,
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
      create.mutate(input, { onSuccess: (created) => router.push(`/hotels/${created.id}`), onError });
    } else {
      save.mutate(input, { onSuccess: (updated) => reset(toFormValues(updated)), onError });
    }
  });

  const fields = (
    <form id={formId} onSubmit={onSubmit} noValidate className="space-y-6">
      <DetailsSection />
      <ImagesSection />
      <AmenitiesSection scope="HOTEL" />
    </form>
  );

  return (
    <FormProvider {...form}>
      {/* Outside the <form>: the header holds the tabs, and the details cards after it have forms of their own */}
      <FormHeader
        formId={formId}
        tabs={tabs}
        heading={heading}
        backHref="/hotels"
        isCreate={isCreate}
        createLabel="สร้างโรงแรม"
        isDirty={isDirty}
        isPending={mutation.isPending}
        isSuccess={mutation.isSuccess}
        error={mutation.error}
        hasFieldError={hasFieldError}
        onDiscard={() => reset()}
      />
      {tabs ? (
        <DetailsPanel>
          {fields}
          {children}
        </DetailsPanel>
      ) : (
        <div className="space-y-6">
          {fields}
          {children}
        </div>
      )}
    </FormProvider>
  );
}

function DetailsSection() {
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
        <Field id="name" label="ชื่อ" error={errors.name?.message}>
          <Input id="name" aria-invalid={!!errors.name} {...register("name")} />
        </Field>
        <Field id="city" label="เมือง" error={errors.city?.message}>
          <Input id="city" aria-invalid={!!errors.city} {...register("city")} />
        </Field>
        <Field id="address" label="ที่อยู่" error={errors.address?.message} className="sm:col-span-2">
          <Input id="address" aria-invalid={!!errors.address} {...register("address")} />
        </Field>
        <Field
          id="description"
          label="คำอธิบาย"
          error={errors.description?.message}
          className="sm:col-span-2"
        >
          <Textarea id="description" aria-invalid={!!errors.description} {...register("description")} />
        </Field>
        <Field id="checkInTime" label="เช็คอินได้ตั้งแต่" error={errors.checkInTime?.message}>
          <Input
            id="checkInTime"
            type="time"
            aria-invalid={!!errors.checkInTime}
            {...register("checkInTime")}
          />
        </Field>
        <Field id="checkOutTime" label="เช็คเอาท์ได้ถึง" error={errors.checkOutTime?.message}>
          <Input
            id="checkOutTime"
            type="time"
            aria-invalid={!!errors.checkOutTime}
            {...register("checkOutTime")}
          />
        </Field>
      </CardContent>
    </Card>
  );
}

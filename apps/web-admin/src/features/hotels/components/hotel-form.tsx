"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import {
  hotelContentInputSchema,
  type AdminHotel,
  type AmenityOption,
} from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@booking/ui/components/card";
import { Checkbox } from "@booking/ui/components/checkbox";
import { Input } from "@booking/ui/components/input";
import { Label } from "@booking/ui/components/label";
import { Skeleton } from "@booking/ui/components/skeleton";
import { Textarea } from "@booking/ui/components/textarea";
import { ImageUpload } from "@booking/ui/components/image-upload";
import { useAmenities } from "@/features/amenities/hooks";
import {
  IMAGE_ACCEPT,
  IMAGE_UPLOAD_HINT,
  useUploadImages,
} from "@/features/uploads/hooks";
import { applyServerFieldErrors, formErrorMessage } from "@/lib/form-errors";
import { useCreateHotel, useSaveHotel } from "../hooks";

const MAX_IMAGES = 20;

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
  /** Extra buttons placed before Back / Save (e.g. Deactivate). */
  actions?: ReactNode;
};

/** Details, times, images and amenities of one hotel — one form, one submit, saved atomically by the API. */
export function HotelForm({ hotel, heading, actions }: HotelFormProps) {
  const router = useRouter();
  const create = useCreateHotel();
  const save = useSaveHotel(hotel?.id ?? "");
  const isCreate = hotel === undefined;
  const mutation = isCreate ? create : save;
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(hotelContentInputSchema),
    defaultValues: hotel ? toFormValues(hotel) : EMPTY_VALUES,
  });
  const hasFieldError = FIELDS.some((f) => errors[f]?.type === "server");

  const onSubmit = handleSubmit((values) => {
    mutation.reset();
    const input = {
      ...values,
      images: values.images.map(({ url, alt }) => ({
        url,
        ...(alt ? { alt } : {}),
      })),
    };
    const onError = (error: unknown) => {
      applyServerFieldErrors(error, setError, FIELDS);
    };
    if (isCreate) {
      create.mutate(input, {
        onSuccess: (created) => router.push(`/hotels/${created.id}`),
        onError,
      });
    } else {
      save.mutate(input, {
        onSuccess: (updated) => reset(toFormValues(updated)),
        onError,
      });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <header className="sticky top-0 z-10 -mx-4 space-y-2 border-b bg-background px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">{heading}</div>
          <div className="flex flex-wrap items-center gap-2">
            <p role="status" className="text-sm text-muted-foreground">
              {!isCreate && mutation.isSuccess && !isDirty ? "Saved" : ""}
            </p>
            {actions}
            <Button asChild variant="outline">
              <Link href="/hotels">Back</Link>
            </Button>
            {!isCreate && (
              <Button
                type="button"
                variant="outline"
                disabled={!isDirty || mutation.isPending}
                onClick={() => reset()}
              >
                Discard
              </Button>
            )}
            <Button
              type="submit"
              disabled={(!isCreate && !isDirty) || mutation.isPending}
            >
              {isCreate
                ? mutation.isPending
                  ? "Creating…"
                  : "Create hotel"
                : mutation.isPending
                  ? "Saving…"
                  : "Save changes"}
            </Button>
          </div>
        </div>
        {mutation.isError && !hasFieldError && (
          <p role="alert" className="text-sm text-destructive">
            {formErrorMessage(mutation.error)}
          </p>
        )}
        {hasFieldError && (
          <p role="alert" className="text-sm text-destructive">
            Some fields need attention. Nothing was saved.
          </p>
        )}
      </header>

      <DetailsSection register={register} errors={errors} />
      <ImagesSection register={register} control={control} errors={errors} />
      <AmenitiesSection control={control} errors={errors} />
    </form>
  );
}

type SectionProps = {
  register: UseFormRegister<FormInput>;
  control: Control<FormInput, unknown, FormOutput>;
  errors: FieldErrors<FormInput>;
};

function DetailsSection({
  register,
  errors,
}: Pick<SectionProps, "register" | "errors">) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Field id="name" label="Name" error={errors.name?.message}>
          <Input id="name" aria-invalid={!!errors.name} {...register("name")} />
        </Field>
        <Field id="city" label="City" error={errors.city?.message}>
          <Input id="city" aria-invalid={!!errors.city} {...register("city")} />
        </Field>
        <Field
          id="address"
          label="Address"
          error={errors.address?.message}
          className="sm:col-span-2"
        >
          <Input
            id="address"
            aria-invalid={!!errors.address}
            {...register("address")}
          />
        </Field>
        <Field
          id="description"
          label="Description"
          error={errors.description?.message}
          className="sm:col-span-2"
        >
          <Textarea
            id="description"
            aria-invalid={!!errors.description}
            {...register("description")}
          />
        </Field>
        <Field
          id="checkInTime"
          label="Check-in from"
          error={errors.checkInTime?.message}
        >
          <Input
            id="checkInTime"
            type="time"
            aria-invalid={!!errors.checkInTime}
            {...register("checkInTime")}
          />
        </Field>
        <Field
          id="checkOutTime"
          label="Check-out until"
          error={errors.checkOutTime?.message}
        >
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

function ImagesSection({ register, control, errors }: SectionProps) {
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "images",
  });
  const images = useWatch({ control, name: "images" });
  const listError = errors.images?.message ?? errors.images?.root?.message;
  const upload = useUploadImages();
  const remaining = MAX_IMAGES - fields.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Images</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">No images yet</p>
        ) : (
          <ol className="space-y-4">
            {fields.map((field, index) => {
              const n = index + 1;
              const rowErrors = errors.images?.[index];
              const preview = images[index]?.url;
              return (
                <li
                  key={field.id}
                  className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row"
                >
                  <div className="aspect-[4/3] w-full shrink-0 overflow-hidden rounded-md bg-muted sm:w-32">
                    {preview && (
                      // Arbitrary admin-entered URLs: next/image would need every host allow-listed
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={preview}
                        alt={images[index]?.alt || `Image ${n}`}
                        className="size-full object-cover"
                      />
                    )}
                  </div>
                  <div className="grid flex-1 gap-3">
                    <Field
                      id={`image-${index}-url`}
                      label={`Image ${n} URL`}
                      error={rowErrors?.url?.message}
                    >
                      <Input
                        id={`image-${index}-url`}
                        type="url"
                        aria-invalid={!!rowErrors?.url}
                        {...register(`images.${index}.url`)}
                      />
                    </Field>
                    <Field
                      id={`image-${index}-alt`}
                      label={`Image ${n} alt text`}
                      error={rowErrors?.alt?.message}
                    >
                      <Input
                        id={`image-${index}-alt`}
                        aria-invalid={!!rowErrors?.alt}
                        {...register(`images.${index}.alt`)}
                      />
                    </Field>
                  </div>
                  <div className="flex gap-2 sm:flex-col">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Move image ${n} up`}
                      disabled={index === 0}
                      onClick={() => move(index, index - 1)}
                    >
                      <ArrowUp className="size-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Move image ${n} down`}
                      disabled={index === fields.length - 1}
                      onClick={() => move(index, index + 1)}
                    >
                      <ArrowDown className="size-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Remove image ${n}`}
                      onClick={() => remove(index)}
                    >
                      <X className="size-4" aria-hidden />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {listError && <p className="text-sm text-destructive">{listError}</p>}
        <ImageUpload
          multiple
          maxFiles={remaining}
          accept={IMAGE_ACCEPT}
          hint={
            remaining > 0
              ? `${IMAGE_UPLOAD_HINT} · ${remaining} left`
              : `Limit of ${MAX_IMAGES} reached`
          }
          disabled={remaining <= 0}
          uploading={upload.isPending}
          onSelect={(files) =>
            upload.mutate(files, {
              onSuccess: ({ urls }) =>
                append(urls.map((url) => ({ url, alt: "" }))),
            })
          }
        />
        {upload.data && upload.data.failed.length > 0 && (
          <p role="alert" className="text-sm text-destructive">
            Not uploaded:{" "}
            {upload.data.failed
              .map((f) => `${f.name} (${f.reason})`)
              .join(", ")}
          </p>
        )}
        {upload.isError && (
          <p role="alert" className="text-sm text-destructive">
            {formErrorMessage(upload.error)}
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={remaining <= 0}
          onClick={() => append({ url: "", alt: "" })}
        >
          <Plus className="size-4" aria-hidden />
          Add image URL
        </Button>
      </CardContent>
    </Card>
  );
}

function AmenitiesSection({
  control,
  errors,
}: Pick<SectionProps, "control" | "errors">) {
  const options = useAmenities("HOTEL");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Amenities</CardTitle>
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
            <p className="text-sm">Couldn&apos;t load amenities.</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void options.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : options.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hotel amenities in the catalog
          </p>
        ) : (
          <AmenityCheckboxes control={control} options={options.data} />
        )}
        {errors.amenityIds?.message && (
          <p className="text-sm text-destructive">
            {errors.amenityIds.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function AmenityCheckboxes({
  control,
  options,
}: {
  control: SectionProps["control"];
  options: AmenityOption[];
}) {
  return (
    <Controller
      control={control}
      name="amenityIds"
      render={({ field }) => (
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">Hotel amenities</legend>
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
                    // Keep catalog (name) order
                    field.onChange(
                      options.filter((o) => ids.has(o.id)).map((o) => o.id),
                    );
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

function Field({
  id,
  label,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <div className="space-y-2">
        <Label htmlFor={id}>{label}</Label>
        {children}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}

"use client";

import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { hotelImagesInputSchema, type AdminHotel } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@booking/ui/components/card";
import { Input } from "@booking/ui/components/input";
import { Label } from "@booking/ui/components/label";
import { formErrorMessage } from "@/lib/form-errors";
import { useReplaceHotelImages } from "../hooks";

const MAX_IMAGES = 20;

type FormInput = z.input<typeof hotelImagesInputSchema>;
type FormOutput = z.output<typeof hotelImagesInputSchema>;

function toFormValues(hotel: AdminHotel): FormInput {
  return { images: hotel.images.map((img) => ({ url: img.url, alt: img.alt ?? "" })) };
}

export function HotelImagesForm({ hotel }: { hotel: AdminHotel }) {
  const mutation = useReplaceHotelImages(hotel.id);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(hotelImagesInputSchema),
    defaultValues: toFormValues(hotel),
  });
  const { fields, append, remove, move } = useFieldArray({ control, name: "images" });
  const images = useWatch({ control, name: "images" });
  const listError = errors.images?.message ?? errors.images?.root?.message;

  const onSubmit = handleSubmit((values) => {
    mutation.reset();
    const input = {
      images: values.images.map(({ url, alt }) => ({ url, ...(alt ? { alt } : {}) })),
    };
    mutation.mutate(input, { onSuccess: (updated) => reset(toFormValues(updated)) });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Images</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">No images yet</p>
          ) : (
            <ol className="space-y-4">
              {fields.map((field, index) => {
                const n = index + 1;
                const rowErrors = errors.images?.[index];
                const preview = images[index]?.url;
                return (
                  <li key={field.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row">
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
                      <div className="space-y-2">
                        <Label htmlFor={`image-${index}-url`}>Image {n} URL</Label>
                        <Input
                          id={`image-${index}-url`}
                          type="url"
                          aria-invalid={!!rowErrors?.url}
                          {...register(`images.${index}.url`)}
                        />
                        {rowErrors?.url && <p className="text-sm text-destructive">{rowErrors.url.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`image-${index}-alt`}>Alt text</Label>
                        <Input
                          id={`image-${index}-alt`}
                          aria-invalid={!!rowErrors?.alt}
                          {...register(`images.${index}.alt`)}
                        />
                        {rowErrors?.alt && <p className="text-sm text-destructive">{rowErrors.alt.message}</p>}
                      </div>
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
          {listError && (
            <p role="alert" className="text-sm text-destructive">
              {listError}
            </p>
          )}
          {mutation.isError && (
            <p role="alert" className="text-sm text-destructive">
              {formErrorMessage(mutation.error)}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={fields.length >= MAX_IMAGES}
              onClick={() => append({ url: "", alt: "" })}
            >
              <Plus className="size-4" aria-hidden />
              Add image
            </Button>
            <Button type="submit" disabled={!isDirty || mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save images"}
            </Button>
            {mutation.isSuccess && !isDirty && <p className="text-sm text-muted-foreground">Saved</p>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

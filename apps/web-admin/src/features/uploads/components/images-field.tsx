"use client";

import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button } from "@booking/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@booking/ui/components/card";
import { ImageUpload } from "@booking/ui/components/image-upload";
import { Input } from "@booking/ui/components/input";
import { Field } from "@/components/form-field";
import { formErrorMessage } from "@/lib/form-errors";
import { IMAGE_ACCEPT, IMAGE_UPLOAD_HINT, useUploadImages } from "../hooks";

const MAX_IMAGES = 20;

/** The slice of a form this section edits (hotel and room type forms both have it). */
type ImagesForm = { images: { url: string; alt?: string }[] };

/** Ordered image list (upload or URL, ↑/↓ reorder) — must be rendered inside a `FormProvider`. */
export function ImagesSection() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<ImagesForm>();
  const { fields, append, remove, move } = useFieldArray({ control, name: "images" });
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
                    <Field id={`image-${index}-url`} label={`Image ${n} URL`} error={rowErrors?.url?.message}>
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
          hint={remaining > 0 ? `${IMAGE_UPLOAD_HINT} · ${remaining} left` : `Limit of ${MAX_IMAGES} reached`}
          disabled={remaining <= 0}
          uploading={upload.isPending}
          onSelect={(files) =>
            upload.mutate(files, {
              onSuccess: ({ urls }) => append(urls.map((url) => ({ url, alt: "" }))),
            })
          }
        />
        {upload.data && upload.data.failed.length > 0 && (
          <p role="alert" className="text-sm text-destructive">
            Not uploaded: {upload.data.failed.map((f) => `${f.name} (${f.reason})`).join(", ")}
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

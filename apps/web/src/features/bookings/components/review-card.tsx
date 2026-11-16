"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Star } from "lucide-react";
import {
  BOOKING_TZ,
  REVIEW_COMMENT_MAX,
  createReviewSchema,
  todayIn,
  type Booking,
  type CreateReviewData,
  type CreateReviewInput,
  type Review,
} from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Label } from "@booking/ui/components/label";
import { Textarea } from "@booking/ui/components/textarea";
import { cn } from "@booking/ui/lib/utils";
import { formatDate } from "@/features/hotels/format";
import { applyServerFieldErrors, formErrorMessage } from "@/lib/form-errors";
import { thaiResolver } from "@/lib/messages-th";
import { useCreateReview } from "../hooks";

const RATINGS = [1, 2, 3, 4, 5] as const;
const RATING_LABELS: Record<number, string> = { 1: "ควรปรับปรุง", 2: "พอใช้", 3: "ดี", 4: "ดีมาก", 5: "ยอดเยี่ยม" };

/** Review form when the stay can be reviewed, read-only view once reviewed, nothing otherwise. */
export function ReviewCard({ booking }: { booking: Booking }) {
  if (booking.review) return <ReviewView review={booking.review} />;
  if (booking.reviewable) return <ReviewForm booking={booking} />;
  return null;
}

function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("flex gap-0.5", className)} aria-hidden="true">
      {RATINGS.map((n) => (
        <Star key={n} className={cn("size-5", n <= value ? "fill-primary text-primary" : "text-muted-foreground")} />
      ))}
    </span>
  );
}

function ReviewView({ review }: { review: Review }) {
  return (
    <section aria-labelledby="review-heading" className="space-y-2 rounded-xl border p-4">
      <h2 id="review-heading" className="text-lg font-semibold">
        รีวิวของคุณ
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <Stars value={review.rating} />
        <span className="sr-only">ให้คะแนน {review.rating} จาก 5</span>
        <span className="text-sm font-medium">{RATING_LABELS[review.rating]}</span>
      </div>
      {review.comment && <p className="text-sm break-words whitespace-pre-line">{review.comment}</p>}
      <p className="text-xs text-muted-foreground">
        รีวิวเมื่อ {formatDate(todayIn(BOOKING_TZ, new Date(review.createdAt)))}
      </p>
    </section>
  );
}

function ReviewForm({ booking }: { booking: Booking }) {
  const review = useCreateReview(booking.code, booking.hotel.slug);
  const [formError, setFormError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CreateReviewInput, unknown, CreateReviewData>({
    resolver: thaiResolver(zodResolver(createReviewSchema)),
    defaultValues: { comment: "" },
  });
  const commentLength = useWatch({ control, name: "comment" })?.length ?? 0;

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    review.mutate(values, {
      onError: (error) => {
        if (!applyServerFieldErrors(error, setError, ["rating", "comment"])) {
          setFormError(formErrorMessage(error));
        }
      },
    });
  });

  return (
    <section aria-labelledby="review-heading" className="space-y-4 rounded-xl border p-4">
      <div className="space-y-1">
        <h2 id="review-heading" className="text-lg font-semibold">
          ให้คะแนนการเข้าพัก
        </h2>
        <p className="text-sm text-muted-foreground">การเข้าพักที่ {booking.hotel.name} เป็นอย่างไรบ้าง? รีวิวของคุณช่วยผู้เข้าพักคนอื่นได้</p>
      </div>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Controller
          control={control}
          name="rating"
          render={({ field }) => {
            const shown = hovered ?? field.value ?? 0;
            return (
              <fieldset className="space-y-2" aria-describedby="rating-hint">
                <legend className="text-sm font-medium">คะแนน</legend>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex gap-0.5" onMouseLeave={() => setHovered(null)}>
                    {RATINGS.map((n) => (
                      <label
                        key={n}
                        className="cursor-pointer rounded-md p-1 has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50"
                        onMouseEnter={() => setHovered(n)}
                      >
                        <input
                          type="radio"
                          name={field.name}
                          value={n}
                          checked={field.value === n}
                          onChange={() => field.onChange(n)}
                          onBlur={field.onBlur}
                          ref={n === 1 ? field.ref : undefined}
                          className="sr-only"
                        />
                        <Star
                          aria-hidden="true"
                          className={cn(
                            "size-7 transition-colors",
                            n <= shown ? "fill-primary text-primary" : "text-muted-foreground",
                          )}
                        />
                        <span className="sr-only">
                          {n} ดาว — {RATING_LABELS[n]}
                        </span>
                      </label>
                    ))}
                  </div>
                  <span id="rating-hint" className="text-sm text-muted-foreground" aria-live="polite">
                    {shown > 0 ? RATING_LABELS[shown] : "เลือก 1–5 ดาว"}
                  </span>
                </div>
                {errors.rating && <p className="text-sm text-destructive">{errors.rating.message}</p>}
              </fieldset>
            );
          }}
        />
        <div className="space-y-2">
          <Label htmlFor="review-comment">
            ความคิดเห็น <span className="font-normal text-muted-foreground">(ไม่บังคับ)</span>
          </Label>
          <Textarea
            id="review-comment"
            rows={4}
            maxLength={REVIEW_COMMENT_MAX}
            placeholder="ชอบอะไรบ้าง? มีอะไรที่ควรปรับปรุง?"
            aria-invalid={!!errors.comment}
            aria-describedby="review-comment-count"
            {...register("comment")}
          />
          <div className="flex justify-between gap-4">
            <p className="text-sm text-destructive">{errors.comment?.message}</p>
            <p id="review-comment-count" className="text-xs text-muted-foreground tabular-nums">
              {commentLength}/{REVIEW_COMMENT_MAX}
            </p>
          </div>
        </div>
        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}
        <Button type="submit" disabled={review.isPending}>
          {review.isPending ? "กำลังส่ง…" : "ส่งรีวิว"}
        </Button>
      </form>
    </section>
  );
}

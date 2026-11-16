"use client";

import { Star } from "lucide-react";
import type { PublicReview } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Skeleton } from "@booking/ui/components/skeleton";
import { cn } from "@booking/ui/lib/utils";
import { formatMonthYear, ratingWord, reviewsLabel } from "../format";
import { useHotelReviews } from "../hooks";

const RATINGS = [1, 2, 3, 4, 5] as const;

type Props = { slug: string; ratingAvg: number; reviewCount: number };

/** Hotel page reviews: average + count, newest reviews first, "Show more" loads the next page. */
export function ReviewsSection({ slug, ratingAvg, reviewCount }: Props) {
  const reviews = useHotelReviews(slug);
  const items = reviews.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <section id="reviews" aria-labelledby="reviews-heading" className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="reviews-heading" className="text-xl font-semibold">
          รีวิวจากผู้เข้าพัก
        </h2>
        {reviewCount > 0 && (
          <p className="flex items-center gap-1.5 text-sm">
            <Star aria-hidden className="size-4 fill-primary text-primary" />
            <span className="font-semibold tabular-nums">{ratingAvg.toFixed(1)}</span>
            <span className="text-muted-foreground">
              {ratingWord(ratingAvg)} · {reviewsLabel(reviewCount)}
            </span>
          </p>
        )}
      </div>

      {reviews.isPending ? (
        <ReviewListSkeleton />
      ) : reviews.isError && items.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
          <p className="text-sm">โหลดรีวิวไม่ได้ในขณะนี้</p>
          <Button variant="outline" onClick={() => void reviews.refetch()} disabled={reviews.isFetching}>
            {reviews.isFetching ? "กำลังลองใหม่…" : "ลองใหม่"}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
          ยังไม่มีรีวิว ผู้เข้าพักรีวิวโรงแรมได้หลังเข้าพักเสร็จ
        </p>
      ) : (
        <>
          <ul className="divide-y rounded-xl border">
            {items.map((review) => (
              <li key={review.id} className="p-4">
                <ReviewItem review={review} />
              </li>
            ))}
          </ul>
          {reviews.isFetchNextPageError && (
            <p role="alert" className="text-sm text-destructive">
              โหลดรีวิวเพิ่มไม่ได้ กรุณาลองใหม่
            </p>
          )}
          {reviews.hasNextPage && (
            <Button
              variant="outline"
              onClick={() => void reviews.fetchNextPage()}
              disabled={reviews.isFetchingNextPage}
            >
              {reviews.isFetchingNextPage ? "กำลังโหลด…" : "ดูรีวิวเพิ่มเติม"}
            </Button>
          )}
        </>
      )}
    </section>
  );
}

function ReviewItem({ review }: { review: PublicReview }) {
  return (
    <article className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex gap-0.5" aria-hidden>
          {RATINGS.map((n) => (
            <Star
              key={n}
              className={cn("size-4", n <= review.rating ? "fill-primary text-primary" : "text-muted-foreground")}
            />
          ))}
        </span>
        <span className="sr-only">ให้คะแนน {review.rating} จาก 5</span>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{review.authorName}</span> · เข้าพักเมื่อ{" "}
          {formatMonthYear(review.stayedAt)}
        </p>
      </div>
      {review.comment && <p className="text-sm break-words whitespace-pre-line">{review.comment}</p>}
    </article>
  );
}

function ReviewListSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-busy="true" aria-label="กำลังโหลดรีวิว">
      {[0, 1].map((i) => (
        <div key={i} className="space-y-2 rounded-lg border p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

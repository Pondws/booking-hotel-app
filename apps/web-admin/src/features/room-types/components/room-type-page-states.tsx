"use client";

import Link from "next/link";
import { Button } from "@booking/ui/components/button";
import { Skeleton } from "@booking/ui/components/skeleton";
import { ApiError } from "@/lib/api";

export function RoomTypePageError({
  error,
  hotelId,
  onRetry,
}: {
  error: Error;
  hotelId: string;
  onRetry: () => void;
}) {
  const status = error instanceof ApiError ? error.status : 0;
  if (status === 403 || status === 404) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {status === 403 ? "You don't have access to this hotel" : "Room type not found"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {status === 403 ? "Ask an admin to assign you to it." : "It may have been deleted, or the link is wrong."}
        </p>
        <Button asChild variant="link" className="px-0">
          <Link href={status === 403 ? "/hotels" : `/hotels/${hotelId}`}>
            {status === 403 ? "Back to hotels" : "Back to the hotel"}
          </Link>
        </Button>
      </div>
    );
  }
  return (
    <div role="alert" className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Couldn&apos;t load this page</h1>
      <Button variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

export function RoomTypePageSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-64" />
      </div>
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-48 w-full rounded-lg" />
      ))}
    </div>
  );
}

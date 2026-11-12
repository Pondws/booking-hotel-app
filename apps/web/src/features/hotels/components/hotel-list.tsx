"use client";

import { Badge } from "@booking/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@booking/ui/components/card";
import { useHotels } from "../hooks";

export function HotelList() {
  const { data, isPending, isError, error } = useHotels();

  if (isPending) return <p className="text-muted-foreground">Loading hotels…</p>;
  if (isError) return <p className="text-destructive">Couldn&apos;t load hotels: {error.message}</p>;
  if (data.length === 0) return <p className="text-muted-foreground">No hotels yet.</p>;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((hotel) => (
        <Card key={hotel.id}>
          <CardHeader>
            <CardTitle>{hotel.name}</CardTitle>
            <CardDescription>{hotel.city}</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">{hotel.reviewCount} reviews</span>
            <Badge variant="outline">★ {hotel.ratingAvg.toFixed(1)}</Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

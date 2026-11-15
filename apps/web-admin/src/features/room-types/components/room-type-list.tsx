"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@booking/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@booking/ui/components/card";
import { Skeleton } from "@booking/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@booking/ui/components/table";
import { HotelStatusBadge } from "@/features/hotels/components/hotel-list";
import { formatMoney } from "../format";
import { useRoomTypes } from "../hooks";

/** Room types of one hotel, shown under the hotel form. */
export function RoomTypeList({ hotelId, currency }: { hotelId: string; currency: string }) {
  const { data, isPending, isError, refetch } = useRoomTypes(hotelId);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>Room types</CardTitle>
        <Button asChild variant="outline">
          <Link href={`/hotels/${hotelId}/room-types/new`}>
            <Plus className="size-4" aria-hidden />
            New room type
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="space-y-2" aria-hidden>
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div role="alert" className="space-y-2">
            <p className="text-sm">Couldn&apos;t load room types.</p>
            <Button variant="outline" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No room types yet. Add one so guests can book this hotel.
          </p>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Guests</TableHead>
                  <TableHead className="text-right">Base price / night</TableHead>
                  <TableHead className="text-right">Rooms active</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((rt) => (
                  <TableRow key={rt.id}>
                    <TableCell className="font-medium">
                      <Link href={`/hotels/${hotelId}/room-types/${rt.id}`} className="hover:underline">
                        {rt.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{rt.capacity}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(rt.basePrice, currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {rt.activeRoomCount} / {rt.roomCount}
                    </TableCell>
                    <TableCell>
                      <HotelStatusBadge isActive={rt.isActive} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { BOOKING_TZ, todayIn, type AdminRatePeriod, type AdminRoomType } from "@booking/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@booking/ui/components/alert-dialog";
import { Badge } from "@booking/ui/components/badge";
import { Button } from "@booking/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@booking/ui/components/card";
import { DataTable, DataTableSkeleton, type DataTableColumn } from "@booking/ui/components/data-table";
import { formatDateRange, formatMoney } from "@/features/room-types/format";
import { formErrorMessage } from "@/lib/form-errors";
import { useDeleteRatePeriod, useRatePeriods } from "../hooks";
import { RatePeriodForm } from "./rate-period-form";

type Editor = { mode: "new" } | { mode: "edit"; period: AdminRatePeriod } | null;

/** Seasonal prices of a room type: a period replaces the base price for the nights it covers. */
export function RatesCard({ roomType }: { roomType: AdminRoomType }) {
  const hotelId = roomType.hotel.id;
  const currency = roomType.hotel.currency;
  const { data: periods, isPending, isError, error, refetch, isFetching } = useRatePeriods(
    hotelId,
    roomType.id,
  );
  const [editor, setEditor] = useState<Editor>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <CardTitle>Rates</CardTitle>
          <p className="text-sm text-muted-foreground">
            Base price {formatMoney(roomType.basePrice, currency)} per night. A rate period replaces it for
            the nights it covers. Existing bookings keep their price.
          </p>
        </div>
        {editor === null && (
          <Button type="button" variant="outline" onClick={() => setEditor({ mode: "new" })}>
            <Plus className="size-4" aria-hidden />
            Add rate period
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {editor !== null && (
          <RatePeriodForm
            // Remount per period so the defaults follow
            key={editor.mode === "edit" ? editor.period.id : "new"}
            hotelId={hotelId}
            roomTypeId={roomType.id}
            currency={currency}
            period={editor.mode === "edit" ? editor.period : undefined}
            onDone={() => setEditor(null)}
          />
        )}
        {isPending ? (
          <DataTableSkeleton rows={2} />
        ) : isError ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-destructive">{formErrorMessage(error)}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        ) : periods.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No rate periods — every night is at the base price.
          </p>
        ) : (
          <DataTable
            caption={`Rate periods of ${roomType.name}`}
            columns={columns(roomType, currency, (period) => setEditor({ mode: "edit", period }))}
            rows={periods}
            getRowKey={(p) => p.id}
            busy={isFetching}
          />
        )}
      </CardContent>
    </Card>
  );
}

function PeriodStatus({ period, today }: { period: AdminRatePeriod; today: string }) {
  if (period.endDate <= today) return <Badge variant="outline">Ended</Badge>;
  if (period.startDate <= today) return <Badge variant="secondary">Now</Badge>;
  return null;
}

function columns(
  roomType: AdminRoomType,
  currency: string,
  onEdit: (period: AdminRatePeriod) => void,
): DataTableColumn<AdminRatePeriod>[] {
  const today = todayIn(BOOKING_TZ);
  return [
    {
      id: "name",
      header: "Name",
      className: "font-medium",
      cell: (p) => p.name ?? <span className="text-muted-foreground">Untitled</span>,
    },
    {
      id: "dates",
      header: "Nights",
      cell: (p) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className="tabular-nums">{formatDateRange(p.startDate, p.endDate)}</span>
          <span className="text-muted-foreground">
            {p.nights} {p.nights === 1 ? "night" : "nights"}
          </span>
          <PeriodStatus period={p} today={today} />
        </div>
      ),
    },
    {
      id: "price",
      header: "Per night",
      className: "text-right tabular-nums",
      cell: (p) => formatMoney(p.price, currency),
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "text-right",
      cell: (p) => (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={`Edit ${p.name ?? formatDateRange(p.startDate, p.endDate)}`}
            onClick={() => onEdit(p)}
          >
            Edit
          </Button>
          <DeletePeriodDialog roomType={roomType} period={p} />
        </div>
      ),
    },
  ];
}

function DeletePeriodDialog({ roomType, period }: { roomType: AdminRoomType; period: AdminRatePeriod }) {
  const [open, setOpen] = useState(false);
  const mutation = useDeleteRatePeriod(roomType.hotel.id, roomType.id);
  const dates = formatDateRange(period.startDate, period.endDate);
  const title = period.name ?? dates;
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (mutation.isPending) return;
        if (next) mutation.reset();
        setOpen(next);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button type="button" size="sm" variant="ghost" className="text-destructive" aria-label={`Delete ${title}`}>
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {title}?</AlertDialogTitle>
          <AlertDialogDescription>
            Nights {dates} go back to the base price for new bookings. Existing bookings keep their price.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {mutation.isError && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {formErrorMessage(mutation.error)}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={(event) => {
              // Stay open to show a failure; close on success
              event.preventDefault();
              mutation.mutate(period.id, { onSuccess: () => setOpen(false) });
            }}
          >
            {mutation.isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

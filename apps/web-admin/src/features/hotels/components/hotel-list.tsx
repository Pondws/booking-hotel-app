"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AdminHotelListQuery, AdminHotelSummary } from "@booking/shared";
import { Badge } from "@booking/ui/components/badge";
import { Button } from "@booking/ui/components/button";
import {
  DataTable,
  DataTableSkeleton,
  type DataTableColumn,
} from "@booking/ui/components/data-table";
import { Input } from "@booking/ui/components/input";
import { Label } from "@booking/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@booking/ui/components/select";
import { Pagination } from "@/components/pagination";
import { useMe } from "@/features/auth/hooks";
import { useAdminHotels } from "../hooks";
import { parseListParams, serializeListParams } from "../list-params";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});

function isStatus(value: string): value is AdminHotelListQuery["status"] {
  return STATUS_OPTIONS.some((o) => o.value === value);
}

export function HotelStatusBadge({ isActive }: { isActive: boolean }) {
  return <Badge variant={isActive ? "secondary" : "outline"}>{isActive ? "Active" : "Inactive"}</Badge>;
}

const COLUMNS: DataTableColumn<AdminHotelSummary>[] = [
  {
    id: "name",
    header: "Name",
    className: "font-medium",
    cell: (hotel) => (
      <Link href={`/hotels/${hotel.id}`} className="hover:underline">
        {hotel.name}
      </Link>
    ),
  },
  { id: "city", header: "City", cell: (hotel) => hotel.city },
  { id: "status", header: "Status", cell: (hotel) => <HotelStatusBadge isActive={hotel.isActive} /> },
  {
    id: "updated",
    header: "Updated",
    className: "text-muted-foreground tabular-nums",
    cell: (hotel) => dateFormat.format(new Date(hotel.updatedAt)),
  },
];

export function HotelList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = parseListParams(new URLSearchParams(searchParams.toString()));
  const { data: me } = useMe();
  const { data, isPending, isError, isPlaceholderData, refetch } = useAdminHotels(query);

  const navigate = (next: Partial<AdminHotelListQuery>) =>
    router.push(`${pathname}${serializeListParams({ ...query, ...next })}`);
  const hasFilters = query.q !== undefined || query.status !== "all";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <form
          key={query.q ?? ""}
          role="search"
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = new FormData(e.currentTarget).get("q");
            navigate({ q: typeof value === "string" && value.trim() ? value.trim() : undefined, page: 1 });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="hotel-search">Search</Label>
            <Input id="hotel-search" name="q" placeholder="Name or city" defaultValue={query.q ?? ""} />
          </div>
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
        <div className="space-y-2">
          <Label htmlFor="hotel-status">Status</Label>
          <Select
            value={query.status}
            onValueChange={(value) => {
              if (isStatus(value)) navigate({ status: value, page: 1 });
            }}
          >
            <SelectTrigger id="hotel-status" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isPending ? (
        <DataTableSkeleton />
      ) : isError ? (
        <div role="alert" className="space-y-2">
          <p className="text-sm">Couldn&apos;t load hotels.</p>
          <Button variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : data.items.length === 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {hasFilters
              ? "No hotels match these filters"
              : me?.role === "ADMIN"
                ? "No hotels yet"
                : "No hotels assigned to you"}
          </p>
          {hasFilters && (
            <Button asChild variant="link" className="px-0">
              <Link href={pathname}>Clear filters</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {data.total} {data.total === 1 ? "hotel" : "hotels"}
          </p>
          <DataTable
            caption="Hotels"
            columns={COLUMNS}
            rows={data.items}
            getRowKey={(hotel) => hotel.id}
            busy={isPlaceholderData}
          />
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            hrefFor={(page) => `${pathname}${serializeListParams({ ...query, page })}`}
            label="Hotel pages"
          />
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AdminHotelListQuery } from "@booking/shared";
import { Badge } from "@booking/ui/components/badge";
import { Button } from "@booking/ui/components/button";
import { Input } from "@booking/ui/components/input";
import { Label } from "@booking/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@booking/ui/components/select";
import { Skeleton } from "@booking/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@booking/ui/components/table";
import { cn } from "@booking/ui/lib/utils";
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
        <HotelTableSkeleton />
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
          <div
            aria-busy={isPlaceholderData}
            className={cn("rounded-lg border", isPlaceholderData && "opacity-60")}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((hotel) => (
                  <TableRow key={hotel.id}>
                    <TableCell className="font-medium">
                      <Link href={`/hotels/${hotel.id}`} className="hover:underline">
                        {hotel.name}
                      </Link>
                    </TableCell>
                    <TableCell>{hotel.city}</TableCell>
                    <TableCell>
                      <HotelStatusBadge isActive={hotel.isActive} />
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {dateFormat.format(new Date(hotel.updatedAt))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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

export function HotelTableSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

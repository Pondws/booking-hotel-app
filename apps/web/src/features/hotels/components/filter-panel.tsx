"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { HotelSearchQuery, HotelSort } from "@booking/shared";
import { Badge } from "@booking/ui/components/badge";
import { Button } from "@booking/ui/components/button";
import { Checkbox } from "@booking/ui/components/checkbox";
import { Input } from "@booking/ui/components/input";
import { Label } from "@booking/ui/components/label";
import { SelectField, type SelectOption } from "@booking/ui/components/select-field";
import { Skeleton } from "@booking/ui/components/skeleton";
import { cn } from "@booking/ui/lib/utils";
import { useHotelAmenities } from "../hooks";
import { hasActiveFilters, searchHref } from "../search-params";

const SORT_OPTIONS: readonly SelectOption<HotelSort>[] = [
  { value: "recommended", label: "แนะนำ" },
  { value: "price_asc", label: "ราคา: ต่ำ → สูง" },
  { value: "price_desc", label: "ราคา: สูง → ต่ำ" },
  { value: "rating_desc", label: "คะแนนรีวิวสูงสุด" },
];

const RATING_OPTIONS = [
  { value: undefined, label: "ทั้งหมด" },
  { value: 3, label: "3+" },
  { value: 4, label: "4+" },
  { value: 4.5, label: "4.5+" },
] as const;

type Patch = Partial<Pick<HotelSearchQuery, "minPrice" | "maxPrice" | "minRating" | "amenities" | "sort">>;

/** `/hotels` filters + sort. Every change is a URL change (back page 1); the URL is the only state. */
export function FilterPanel({ query, className }: { query: HotelSearchQuery; className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const apply = (patch: Patch) => router.push(searchHref({ ...query, ...patch, page: 1 }), { scroll: false });
  const activeCount =
    (query.minPrice !== undefined || query.maxPrice !== undefined ? 1 : 0) +
    (query.minRating !== undefined ? 1 : 0) +
    (query.amenities?.length ?? 0);

  return (
    <aside aria-labelledby="filters-heading" className={cn("rounded-xl border bg-card p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 id="filters-heading" className="flex items-center gap-2 font-semibold">
          <SlidersHorizontal aria-hidden className="size-4" />
          ตัวกรอง
          {activeCount > 0 && <Badge variant="secondary">{activeCount}</Badge>}
        </h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="lg:hidden"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "ซ่อน" : "แสดง"}
        </Button>
      </div>

      <div id={contentId} className={cn("mt-4 space-y-6", !open && "hidden lg:block")}>
        <div className="space-y-2">
          <Label htmlFor="filter-sort">เรียงตาม</Label>
          <SelectField
            id="filter-sort"
            options={SORT_OPTIONS}
            value={query.sort}
            onValueChange={(sort) => apply({ sort })}
            className="w-full"
          />
        </div>

        {/* Remount on URL change so the inputs follow back/forward and "clear" */}
        <PriceRange key={`${query.minPrice ?? ""}-${query.maxPrice ?? ""}`} query={query} onApply={apply} />

        <FilterGroup legend="คะแนนรีวิว">
          <div className="flex flex-wrap gap-2">
            {RATING_OPTIONS.map(({ value, label }) => {
              const active = query.minRating === value;
              return (
                <Button
                  key={label}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  aria-pressed={active}
                  onClick={() => apply({ minRating: value })}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        </FilterGroup>

        <AmenityFilter selected={query.amenities ?? []} onChange={(amenities) => apply({ amenities })} />

        {(hasActiveFilters(query) || query.sort !== "recommended") && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() =>
              apply({
                minPrice: undefined,
                maxPrice: undefined,
                minRating: undefined,
                amenities: undefined,
                sort: "recommended",
              })
            }
          >
            ล้างตัวกรองทั้งหมด
          </Button>
        )}
      </div>
    </aside>
  );
}

function FilterGroup({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      {children}
    </fieldset>
  );
}

/** Whole baht, empty = no bound. Applied on submit so typing doesn't fire a search per keystroke. */
function PriceRange({ query, onApply }: { query: HotelSearchQuery; onApply: (patch: Patch) => void }) {
  const [min, setMin] = useState(query.minPrice?.toString() ?? "");
  const [max, setMax] = useState(query.maxPrice?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);

  const toBound = (v: string): number | undefined | null => {
    const t = v.trim();
    if (t === "") return undefined;
    return /^\d{1,8}$/.test(t) ? Number(t) : null;
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const minPrice = toBound(min);
    const maxPrice = toBound(max);
    if (minPrice === null || maxPrice === null) return setError("กรอกราคาเป็นตัวเลขจำนวนเต็ม");
    if (minPrice !== undefined && maxPrice !== undefined && maxPrice < minPrice) {
      return setError("ราคาสูงสุดต้องไม่น้อยกว่าราคาต่ำสุด");
    }
    setError(null);
    onApply({ minPrice, maxPrice });
  };

  return (
    <form onSubmit={onSubmit} noValidate aria-label="ช่วงราคา">
      <FilterGroup legend="ราคาต่อคืน (บาท)">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="filter-min-price" className="text-xs text-muted-foreground">
              ต่ำสุด
            </Label>
            <Input
              id="filter-min-price"
              inputMode="numeric"
              placeholder="0"
              value={min}
              aria-invalid={!!error}
              onChange={(e) => setMin(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="filter-max-price" className="text-xs text-muted-foreground">
              สูงสุด
            </Label>
            <Input
              id="filter-max-price"
              inputMode="numeric"
              placeholder="ไม่จำกัด"
              value={max}
              aria-invalid={!!error}
              onChange={(e) => setMax(e.target.value)}
            />
          </div>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" variant="outline" size="sm" className="w-full">
          ใช้ช่วงราคา
        </Button>
      </FilterGroup>
    </form>
  );
}

function AmenityFilter({ selected, onChange }: { selected: string[]; onChange: (codes: string[] | undefined) => void }) {
  const { data, isPending, isError, refetch, isFetching } = useHotelAmenities();

  let body: ReactNode;
  if (isPending) {
    body = (
      <div className="space-y-2" role="status" aria-busy="true" aria-label="กำลังโหลดสิ่งอำนวยความสะดวก">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  } else if (isError) {
    body = (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">โหลดตัวเลือกไม่ได้</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? "กำลังลองใหม่…" : "ลองใหม่"}
        </Button>
      </div>
    );
  } else if (data.length === 0) {
    body = <p className="text-sm text-muted-foreground">ยังไม่มีตัวเลือก</p>;
  } else {
    body = (
      <ul className="space-y-2">
        {data.map((a) => {
          const id = `filter-amenity-${a.code}`;
          const checked = selected.includes(a.code);
          return (
            <li key={a.code} className="flex items-center gap-2">
              <Checkbox
                id={id}
                checked={checked}
                onCheckedChange={(next) => {
                  const codes = next === true ? [...selected, a.code] : selected.filter((c) => c !== a.code);
                  onChange(codes.length > 0 ? codes : undefined);
                }}
              />
              <Label htmlFor={id} className="font-normal">
                {a.name}
              </Label>
            </li>
          );
        })}
      </ul>
    );
  }

  return <FilterGroup legend="สิ่งอำนวยความสะดวก">{body}</FilterGroup>;
}

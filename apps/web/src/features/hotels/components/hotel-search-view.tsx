"use client";

import { useSearchParams } from "next/navigation";
import { parseSearchParams } from "../search-params";
import { FilterPanel } from "./filter-panel";
import { HotelResults } from "./hotel-results";
import { SearchBar } from "./search-bar";

/** `/hotels`: the URL is the only source of search state. */
export function HotelSearchView() {
  const searchParams = useSearchParams();
  const query = parseSearchParams(new URLSearchParams(searchParams.toString()));

  return (
    <>
      <div className="bg-primary">
        <div className="mx-auto w-full max-w-6xl px-4 py-4">
          {/* Remount on URL change so back/forward and pagination keep the form in sync */}
          <SearchBar key={searchParams.toString()} defaultValues={query} className="shadow-none" />
        </div>
      </div>
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 lg:grid-cols-4 lg:items-start">
        <FilterPanel className="lg:sticky lg:top-24" />
        <div className="space-y-4 lg:col-span-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {query.city ? `ที่พักใน ${query.city}` : "ที่พักทั้งหมด"}
          </h1>
          <HotelResults query={query} showCount />
        </div>
      </div>
    </>
  );
}

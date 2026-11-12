"use client";

import { useSearchParams } from "next/navigation";
import { parseSearchParams } from "../search-params";
import { HotelResults } from "./hotel-results";
import { SearchBar } from "./search-bar";

/** `/hotels`: the URL is the only source of search state. */
export function HotelSearchView() {
  const searchParams = useSearchParams();
  const query = parseSearchParams(new URLSearchParams(searchParams.toString()));

  return (
    <div className="space-y-6">
      {/* Remount on URL change so back/forward and pagination keep the form in sync */}
      <SearchBar key={searchParams.toString()} defaultValues={query} />
      <HotelResults query={query} />
    </div>
  );
}

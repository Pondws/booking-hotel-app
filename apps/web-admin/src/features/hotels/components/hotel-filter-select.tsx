"use client";

import { SelectField } from "@booking/ui/components/select-field";
import { useAdminHotels } from "../hooks";

const ALL_HOTELS = "all";

/** Staff see their own hotels here; 50 covers every real chain we manage. */
const HOTEL_OPTIONS_QUERY = { status: "all", page: 1, pageSize: 50 } as const;

/** "ทุกโรงแรม" + the hotels the signed-in user can see; `undefined` = all hotels. */
export function HotelFilterSelect({
  id,
  value,
  onChange,
  className = "w-48",
}: {
  id?: string;
  value: string | undefined;
  onChange: (hotelId: string | undefined) => void;
  className?: string;
}) {
  const hotels = useAdminHotels(HOTEL_OPTIONS_QUERY);
  const options = [
    { value: ALL_HOTELS, label: "ทุกโรงแรม" },
    ...(hotels.data?.items.map((h) => ({ value: h.id, label: h.name })) ?? []),
  ];

  return (
    <SelectField
      id={id}
      className={className}
      options={options}
      value={value ?? ALL_HOTELS}
      onValueChange={(next) => onChange(next === ALL_HOTELS ? undefined : next)}
    />
  );
}

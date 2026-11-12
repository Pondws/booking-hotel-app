import {
  Bath,
  Car,
  Check,
  Coffee,
  Snowflake,
  Waves,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import type { HotelDetail } from "@booking/shared";
import { cn } from "@booking/ui/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  wifi: Wifi,
  pool: Waves,
  parking: Car,
  breakfast: Coffee,
  aircon: Snowflake,
  bathtub: Bath,
};

/** Icon for an amenity code; unknown codes get a plain check mark. */
export function amenityIcon(code: string): LucideIcon {
  return ICONS[code] ?? Check;
}

type Props = {
  amenities: HotelDetail["amenities"];
  className?: string;
};

export function AmenityList({ amenities, className }: Props) {
  if (amenities.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-2 text-sm", className)}>
      {amenities.map((amenity) => {
        const Icon = amenityIcon(amenity.code);
        return (
          <li key={amenity.code} className="flex items-center gap-1.5">
            <Icon aria-hidden className="size-4 text-muted-foreground" />
            {amenity.name}
          </li>
        );
      })}
    </ul>
  );
}

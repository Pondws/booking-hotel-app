"use client";

import Image from "next/image";
import { useState } from "react";
import type { HotelDetail } from "@booking/shared";
import { cn } from "@booking/ui/lib/utils";

type Props = {
  images: HotelDetail["images"];
  /** Fallback alt text (the hotel name). */
  name: string;
};

/** Main photo plus a row of thumbnail buttons that switch it. */
export function HotelGallery({ images, name }: Props) {
  const [selected, setSelected] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
        No photos yet
      </div>
    );
  }

  const current = images[Math.min(selected, images.length - 1)];

  return (
    <div className="space-y-3">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
        <Image
          src={current.url}
          alt={current.alt ?? name}
          fill
          priority
          sizes="(min-width: 1024px) 1024px, 100vw"
          className="object-cover"
        />
      </div>
      {images.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Photos">
          {images.map((image, i) => (
            <li key={image.url} className="shrink-0">
              <button
                type="button"
                onClick={() => setSelected(i)}
                aria-label={`Show photo ${i + 1} of ${images.length}`}
                aria-pressed={i === selected}
                className={cn(
                  "relative block aspect-[4/3] w-24 overflow-hidden rounded-md bg-muted outline-none transition-opacity focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-28",
                  i === selected ? "ring-2 ring-primary" : "opacity-70 hover:opacity-100",
                )}
              >
                <Image src={image.url} alt="" fill sizes="112px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

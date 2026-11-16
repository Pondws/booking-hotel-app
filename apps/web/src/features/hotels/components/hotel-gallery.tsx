"use client";

import Image from "next/image";
import { useState } from "react";
import { Grid2x2, ImageOff } from "lucide-react";
import type { HotelDetail } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { cn } from "@booking/ui/lib/utils";

type Props = {
  images: HotelDetail["images"];
  /** Fallback alt text (the hotel name). */
  name: string;
};

const MOSAIC = 5;

/**
 * Airbnb-style: on md+ a mosaic (one large photo + four small) when there are enough photos; on phones (or
 * with few photos) one main photo with thumbnail buttons that switch it. "ดูรูปทั้งหมด" lists every photo.
 */
export function HotelGallery({ images, name }: Props) {
  const [selected, setSelected] = useState(0);
  const [showAll, setShowAll] = useState(false);

  if (images.length === 0) {
    return (
      <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-xl bg-muted text-sm text-muted-foreground">
        <ImageOff aria-hidden className="size-6" />
        ยังไม่มีรูปภาพ
      </div>
    );
  }

  const current = images[Math.min(selected, images.length - 1)];
  const mosaic = images.length >= MOSAIC;

  return (
    <div className="space-y-3">
      {mosaic && (
        <div className="relative hidden aspect-[2/1] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-xl md:grid">
          {images.slice(0, MOSAIC).map((image, i) => (
            <div key={image.url} className={cn("relative bg-muted", i === 0 && "col-span-2 row-span-2")}>
              <Image
                src={image.url}
                alt={image.alt ?? name}
                fill
                priority={i === 0}
                sizes={i === 0 ? "(min-width: 1152px) 576px, 50vw" : "(min-width: 1152px) 288px, 25vw"}
                className="object-cover"
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="absolute right-3 bottom-3 bg-background"
            aria-expanded={showAll}
            aria-controls="all-photos"
            onClick={() => setShowAll((v) => !v)}
          >
            <Grid2x2 aria-hidden className="size-4" />
            {showAll ? "ซ่อนรูปทั้งหมด" : `ดูรูปทั้งหมด (${images.length})`}
          </Button>
        </div>
      )}

      <div className={cn("space-y-3", mosaic && "md:hidden")}>
        <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
          <Image
            src={current.url}
            alt={current.alt ?? name}
            fill
            priority
            sizes="(min-width: 1152px) 1152px, 100vw"
            className="object-cover"
          />
        </div>
        {images.length > 1 && (
          <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="รูปภาพ">
            {images.map((image, i) => (
              <li key={image.url} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setSelected(i)}
                  aria-label={`แสดงรูปที่ ${i + 1} จาก ${images.length}`}
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

      {mosaic && showAll && (
        <ul id="all-photos" aria-label="รูปภาพทั้งหมด" className="hidden gap-2 md:grid md:grid-cols-3">
          {images.map((image) => (
            <li key={image.url} className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted">
              <Image src={image.url} alt={image.alt ?? name} fill sizes="384px" className="object-cover" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

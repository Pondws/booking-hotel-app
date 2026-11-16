"use client";

import Image from "next/image";
import { useState, type MouseEvent } from "react";
import { Expand, Grid2x2, ImageOff } from "lucide-react";
import type { HotelDetail } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { cn } from "@booking/ui/lib/utils";
import { PhotoLightbox } from "./photo-lightbox";

type Props = {
  images: HotelDetail["images"];
  /** Fallback alt text (the hotel name). */
  name: string;
};

const MOSAIC = 5;

const PHOTO_BUTTON =
  "group relative block overflow-hidden bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset";

/**
 * Airbnb-style: on md+ a mosaic (one large photo + four small) when there are enough photos; on phones (or
 * with few photos) one main photo with thumbnail buttons that switch it. Any photo (and "ดูรูปทั้งหมด") opens
 * the full-screen lightbox.
 */
export function HotelGallery({ images, name }: Props) {
  const [selected, setSelected] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [opener, setOpener] = useState<HTMLElement | null>(null);

  if (images.length === 0) {
    return (
      <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-xl bg-muted text-sm text-muted-foreground">
        <ImageOff aria-hidden className="size-6" />
        ยังไม่มีรูปภาพ
      </div>
    );
  }

  const count = images.length;
  const currentIndex = Math.min(selected, count - 1);
  const current = images[currentIndex];
  const mosaic = count >= MOSAIC;
  const open = (i: number) => (event: MouseEvent<HTMLElement>) => {
    setOpener(event.currentTarget);
    setLightbox(i);
  };

  return (
    <div className="space-y-3">
      {mosaic && (
        <div className="relative hidden aspect-[2/1] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-xl md:grid">
          {images.slice(0, MOSAIC).map((image, i) => (
            <button
              key={image.url}
              type="button"
              onClick={open(i)}
              aria-label={`ดูรูปที่ ${i + 1} จาก ${count} แบบเต็มจอ`}
              className={cn(PHOTO_BUTTON, i === 0 && "col-span-2 row-span-2")}
            >
              <Image
                src={image.url}
                alt={image.alt ?? name}
                fill
                priority={i === 0}
                sizes={i === 0 ? "(min-width: 1152px) 576px, 50vw" : "(min-width: 1152px) 288px, 25vw"}
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </button>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="absolute right-3 bottom-3 bg-background"
            onClick={open(0)}
          >
            <Grid2x2 aria-hidden className="size-4" />
            ดูรูปทั้งหมด ({count})
          </Button>
        </div>
      )}

      <div className={cn("space-y-3", mosaic && "md:hidden")}>
        <button
          type="button"
          onClick={open(currentIndex)}
          aria-label={`ดูรูปที่ ${currentIndex + 1} จาก ${count} แบบเต็มจอ`}
          className={cn(PHOTO_BUTTON, "aspect-video w-full rounded-xl")}
        >
          <Image
            src={current.url}
            alt={current.alt ?? name}
            fill
            priority
            sizes="(min-width: 1152px) 1152px, 100vw"
            className="object-cover"
          />
          <span className="absolute right-3 bottom-3 flex items-center gap-1 rounded-md bg-background/90 px-2 py-1 text-xs font-medium">
            <Expand aria-hidden className="size-3.5" />
            {currentIndex + 1} / {count}
          </span>
        </button>
        {count > 1 && (
          <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="รูปภาพ">
            {images.map((image, i) => (
              <li key={image.url} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setSelected(i)}
                  aria-label={`แสดงรูปที่ ${i + 1} จาก ${count}`}
                  aria-pressed={i === currentIndex}
                  className={cn(
                    "relative block aspect-[4/3] w-24 overflow-hidden rounded-md bg-muted outline-none transition-opacity focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-28",
                    i === currentIndex ? "ring-2 ring-primary" : "opacity-70 hover:opacity-100",
                  )}
                >
                  <Image src={image.url} alt="" fill sizes="112px" className="object-cover" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <PhotoLightbox
        images={images}
        name={name}
        index={lightbox}
        onIndexChange={(i) => {
          setLightbox(i);
          // The phone layout's main photo follows the lightbox, so closing lands on the last photo seen
          setSelected(i);
        }}
        onClose={() => setLightbox(null)}
        returnFocusTo={opener}
      />
    </div>
  );
}

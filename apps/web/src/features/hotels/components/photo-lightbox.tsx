"use client";

import Image from "next/image";
import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { HotelDetail } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@booking/ui/components/dialog";
import { cn } from "@booking/ui/lib/utils";

type Props = {
  images: HotelDetail["images"];
  /** Fallback alt text (the hotel name). */
  name: string;
  /** Open on this photo; null = closed. */
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** Gets focus back when the lightbox closes (the photo or button that opened it). */
  returnFocusTo?: HTMLElement | null;
};

const SWIPE_PX = 50;

/** Full-screen photo viewer: ← → keys, swipe, wrap-around, thumbnail strip; Esc closes (Radix). */
export function PhotoLightbox({ images, name, index, onIndexChange, onClose, returnFocusTo }: Props) {
  const count = images.length;
  const current = index === null ? null : (images[index] ?? null);
  const swipeStart = useRef<number | null>(null);
  const activeThumb = useRef<HTMLButtonElement | null>(null);

  const go = (delta: number) => {
    if (index === null || count < 2) return;
    onIndexChange((index + delta + count) % count);
  };

  // Keep the current thumbnail in view as the photo changes
  useEffect(() => {
    activeThumb.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [index]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      go(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(-1);
    }
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === "touch") swipeStart.current = event.clientX;
  };
  const onPointerUp = (event: PointerEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (start === null) return;
    const dx = event.clientX - start;
    if (Math.abs(dx) >= SWIPE_PX) go(dx < 0 ? 1 : -1);
  };

  return (
    <Dialog open={current !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        onKeyDown={onKeyDown}
        onCloseAutoFocus={(event) => {
          if (!returnFocusTo) return;
          event.preventDefault();
          returnFocusTo.focus();
        }}
        className="flex h-dvh w-screen max-w-none flex-col gap-0 rounded-none border-0 bg-background p-0 sm:max-w-none"
      >
        {current && index !== null && (
          <>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <DialogTitle className="truncate text-sm font-medium">{name}</DialogTitle>
              <div className="flex items-center gap-3">
                <p aria-live="polite" className="text-sm text-muted-foreground tabular-nums">
                  {index + 1} / {count}
                </p>
                <DialogClose asChild>
                  <Button type="button" variant="ghost" size="icon" aria-label="ปิด">
                    <X aria-hidden className="size-5" />
                  </Button>
                </DialogClose>
              </div>
            </div>
            <DialogDescription className="sr-only">
              รูปที่ {index + 1} จาก {count} ใช้ปุ่มลูกศรซ้ายขวาเพื่อเปลี่ยนรูป กด Esc เพื่อปิด
            </DialogDescription>

            <div
              className="relative min-h-0 flex-1 touch-pan-y bg-muted"
              onPointerDown={onPointerDown}
              onPointerUp={onPointerUp}
              onPointerCancel={() => (swipeStart.current = null)}
            >
              <Image
                key={current.url}
                src={current.url}
                alt={current.alt ?? name}
                fill
                sizes="100vw"
                className="object-contain"
              />
              {count > 1 && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="รูปก่อนหน้า"
                    className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full bg-background/90"
                    onClick={() => go(-1)}
                  >
                    <ChevronLeft aria-hidden className="size-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="รูปถัดไป"
                    className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-background/90"
                    onClick={() => go(1)}
                  >
                    <ChevronRight aria-hidden className="size-5" />
                  </Button>
                </>
              )}
            </div>

            {count > 1 && (
              <ul className="flex gap-2 overflow-x-auto px-4 py-3" aria-label="รูปภาพทั้งหมด">
                {images.map((image, i) => (
                  <li key={image.url} className="shrink-0">
                    <button
                      ref={i === index ? activeThumb : undefined}
                      type="button"
                      onClick={() => onIndexChange(i)}
                      aria-label={`รูปที่ ${i + 1} จาก ${count}`}
                      aria-current={i === index ? "true" : undefined}
                      className={cn(
                        "relative block aspect-[4/3] w-20 overflow-hidden rounded-md bg-muted outline-none transition-opacity focus-visible:ring-[3px] focus-visible:ring-ring/50",
                        i === index ? "ring-2 ring-primary" : "opacity-60 hover:opacity-100",
                      )}
                    >
                      <Image src={image.url} alt="" fill sizes="80px" className="object-cover" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

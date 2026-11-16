"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Heart } from "lucide-react";
import { Button } from "@booking/ui/components/button";
import { cn } from "@booking/ui/lib/utils";
import { useMe } from "@/features/auth/hooks";
import { useSavedHotelIds } from "../hooks";
import { SaveToWishlistDialog } from "./save-to-wishlist-dialog";

type Props = {
  hotelId: string;
  hotelName: string;
  /** "overlay" = round button on a photo (hotel card); "inline" = outline button with a label (hotel page). */
  variant?: "overlay" | "inline";
  className?: string;
};

/**
 * Filled when the hotel is in any list. Signed out → login (back here after); signed in → the save dialog.
 * Must sit outside the card's <Link> (no interactive element inside a link).
 */
export function WishlistHeart({ hotelId, hotelName, variant = "overlay", className }: Props) {
  const router = useRouter();
  const { data: me } = useMe();
  const saved = useSavedHotelIds().has(hotelId);
  const [open, setOpen] = useState(false);

  const onClick = () => {
    if (!me) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    setOpen(true);
  };

  const label = saved ? `${hotelName} อยู่ในรายการโปรดแล้ว จัดการรายการ` : `บันทึก ${hotelName} ลงรายการโปรด`;
  const icon = <Heart aria-hidden className={cn("size-5", saved && "fill-primary text-primary")} />;

  return (
    <>
      {variant === "overlay" ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={label}
          aria-haspopup="dialog"
          onClick={onClick}
          className={cn("rounded-full border-0 bg-background/90 shadow-sm hover:bg-background", className)}
        >
          {icon}
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          aria-label={label}
          aria-haspopup="dialog"
          onClick={onClick}
          className={className}
        >
          {icon}
          {saved ? "บันทึกแล้ว" : "บันทึก"}
        </Button>
      )}
      {me && <SaveToWishlistDialog hotelId={hotelId} hotelName={hotelName} open={open} onOpenChange={setOpen} />}
    </>
  );
}

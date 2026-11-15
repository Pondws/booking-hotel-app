"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@booking/ui/components/button";
import { formErrorMessage } from "@/lib/form-errors";

type FormHeaderProps = {
  /** Left side: page title, status… */
  heading: ReactNode;
  /** The form's id, when the header sits outside the `<form>` (Save submits it via `form=`). */
  formId?: string;
  /** Shown at the bottom of the header (e.g. `DetailTabsList`), so it stays visible while scrolling. */
  tabs?: ReactNode;
  backHref: string;
  /** Create mode: no Discard / "Saved", submit is always enabled. */
  isCreate: boolean;
  createLabel: string;
  isDirty: boolean;
  isPending: boolean;
  isSuccess: boolean;
  /** The mutation error, if any. */
  error: unknown;
  /** True when the server error was mapped onto fields. */
  hasFieldError: boolean;
  onDiscard: () => void;
};

/**
 * Sticky header of a whole-page admin form: title + Back / Save on the right; the save status (and Discard,
 * while there are unsaved edits) under the title. Page actions such as Deactivate live in the page, not here.
 */
export function FormHeader({
  heading,
  formId,
  tabs,
  backHref,
  isCreate,
  createLabel,
  isDirty,
  isPending,
  isSuccess,
  error,
  hasFieldError,
  onDiscard,
}: FormHeaderProps) {
  return (
    <header className="sticky top-0 z-10 -mx-4 space-y-2 border-b bg-background px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">{heading}</div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href={backHref}>กลับ</Link>
          </Button>
          <Button type="submit" form={formId} disabled={(!isCreate && !isDirty) || isPending}>
            {isCreate
              ? isPending
                ? "กำลังสร้าง…"
                : createLabel
              : isPending
                ? "กำลังบันทึก…"
                : "บันทึกการเปลี่ยนแปลง"}
          </Button>
        </div>
      </div>
      {!isCreate && (
        <div role="status" className="flex min-h-6 flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          {isDirty ? (
            <>
              <span>มีการแก้ไขที่ยังไม่บันทึก</span>
              <span aria-hidden>·</span>
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-sm"
                disabled={isPending}
                onClick={onDiscard}
              >
                ยกเลิกการแก้ไข
              </Button>
            </>
          ) : isSuccess ? (
            <span>บันทึกแล้ว</span>
          ) : null}
        </div>
      )}
      {error != null && !hasFieldError && (
        <p role="alert" className="text-sm text-destructive">
          {formErrorMessage(error)}
        </p>
      )}
      {hasFieldError && (
        <p role="alert" className="text-sm text-destructive">
          มีบางช่องที่ต้องแก้ไข ยังไม่ได้บันทึกข้อมูล
        </p>
      )}
      {tabs && <div className="pt-1">{tabs}</div>}
    </header>
  );
}

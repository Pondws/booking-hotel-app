"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@booking/ui/components/button";
import { formErrorMessage } from "@/lib/form-errors";

type FormHeaderProps = {
  /** Left side: page title, status… */
  heading: ReactNode;
  /** Extra buttons placed before Back / Save (e.g. Deactivate). */
  actions?: ReactNode;
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

/** Sticky header of a whole-page admin form: title, actions, Back / Discard / Save and the save status. */
export function FormHeader({
  heading,
  actions,
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
          <p role="status" className="text-sm text-muted-foreground">
            {!isCreate && isSuccess && !isDirty ? "Saved" : ""}
          </p>
          {actions}
          <Button asChild variant="outline">
            <Link href={backHref}>Back</Link>
          </Button>
          {!isCreate && (
            <Button type="button" variant="outline" disabled={!isDirty || isPending} onClick={onDiscard}>
              Discard
            </Button>
          )}
          <Button type="submit" disabled={(!isCreate && !isDirty) || isPending}>
            {isCreate
              ? isPending
                ? "Creating…"
                : createLabel
              : isPending
                ? "Saving…"
                : "Save changes"}
          </Button>
        </div>
      </div>
      {error != null && !hasFieldError && (
        <p role="alert" className="text-sm text-destructive">
          {formErrorMessage(error)}
        </p>
      )}
      {hasFieldError && (
        <p role="alert" className="text-sm text-destructive">
          Some fields need attention. Nothing was saved.
        </p>
      )}
    </header>
  );
}

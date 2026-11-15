"use client"

import * as React from "react"
import { ImageUp } from "lucide-react"
import { cn } from "@booking/ui/lib/utils"

type ImageUploadProps = {
  /** Called with the picked files (always one file when `multiple` is false). */
  onSelect: (files: File[]) => void
  /** Allow picking several files at once. Default false (single). */
  multiple?: boolean
  /** Cap for `multiple` (e.g. remaining slots); extra files are dropped. */
  maxFiles?: number
  /** `accept` attribute, e.g. "image/jpeg,image/png,image/webp". */
  accept?: string
  disabled?: boolean
  /** Shows a busy state while the caller uploads. */
  uploading?: boolean
  /** Main line of the drop zone. */
  label?: React.ReactNode
  /** Main line while `uploading`. */
  uploadingLabel?: React.ReactNode
  /** Secondary line, e.g. "JPEG, PNG or WebP, up to 5 MB". */
  hint?: React.ReactNode
  id?: string
  className?: string
}

/**
 * Click-or-drop image picker. It only selects files — uploading, previews and errors belong to
 * the caller, so the same component works for a single cover image and for a gallery.
 */
function ImageUpload({
  onSelect,
  multiple = false,
  maxFiles,
  accept = "image/*",
  disabled = false,
  uploading = false,
  label,
  uploadingLabel = "Uploading…",
  hint,
  id,
  className,
}: ImageUploadProps) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId
  const [dragging, setDragging] = React.useState(false)
  const inactive = disabled || uploading

  const pick = (list: FileList | null) => {
    if (!list || inactive) return
    const accepted = Array.from(list).filter((file) => file.type.startsWith("image/"))
    const files = multiple ? accepted.slice(0, maxFiles ?? accepted.length) : accepted.slice(0, 1)
    if (files.length > 0) onSelect(files)
  }

  return (
    <label
      htmlFor={inputId}
      data-slot="image-upload"
      data-dragging={dragging || undefined}
      aria-disabled={inactive || undefined}
      aria-busy={uploading || undefined}
      onDragOver={(e) => {
        e.preventDefault()
        if (!inactive) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        pick(e.dataTransfer.files)
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center text-sm",
        "hover:bg-accent focus-within:ring-2 focus-within:ring-ring",
        "data-[dragging]:border-primary data-[dragging]:bg-accent",
        "aria-disabled:cursor-not-allowed aria-disabled:opacity-60 aria-disabled:hover:bg-transparent",
        className
      )}
    >
      <ImageUp className="size-5 text-muted-foreground" aria-hidden />
      <span className="font-medium">
        {uploading ? uploadingLabel : (label ?? (multiple ? "Upload images" : "Upload an image"))}
      </span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      <input
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={inactive}
        className="sr-only"
        onChange={(e) => {
          pick(e.currentTarget.files)
          // Picking the same file again must fire onChange again
          e.currentTarget.value = ""
        }}
      />
    </label>
  )
}

export { ImageUpload }

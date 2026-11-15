import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@booking/ui/lib/utils"

/**
 * Vertical activity timeline: an ordered list of items, each with an icon on a connecting line.
 *
 * <Timeline>
 *   <TimelineItem>
 *     <TimelineIcon variant="primary"><Plus /></TimelineIcon>
 *     <TimelineContent>
 *       <TimelineHeader><TimelineTitle>…</TimelineTitle><TimelineTime dateTime={iso}>…</TimelineTime></TimelineHeader>
 *       <TimelineDescription>…</TimelineDescription>
 *     </TimelineContent>
 *   </TimelineItem>
 * </Timeline>
 */
function Timeline({ className, ...props }: React.ComponentProps<"ol">) {
  return <ol data-slot="timeline" className={cn("flex flex-col", className)} {...props} />
}

/** One activity. The line to the next item is drawn here and hidden on the last one. */
function TimelineItem({ className, children, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="timeline-item"
      className={cn("group/timeline-item relative flex gap-3 pb-6 last:pb-0", className)}
      {...props}
    >
      <span
        aria-hidden
        className="absolute top-9 bottom-1 left-4 w-px -translate-x-1/2 bg-border group-last/timeline-item:hidden"
      />
      {children}
    </li>
  )
}

const timelineIconVariants = cva(
  "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "border-border bg-background text-foreground",
        primary: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        muted: "border-transparent bg-muted text-muted-foreground",
        destructive: "border-destructive/30 bg-background text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

/** The activity icon. Decorative: say what happened in the title too. */
function TimelineIcon({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof timelineIconVariants>) {
  return (
    <span
      aria-hidden
      data-slot="timeline-icon"
      data-variant={variant}
      className={cn(timelineIconVariants({ variant }), className)}
      {...props}
    />
  )
}

function TimelineContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="timeline-content" className={cn("min-w-0 flex-1 space-y-2 pt-1", className)} {...props} />
  )
}

/** Title on the left, time on the right; wraps on narrow screens. */
function TimelineHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="timeline-header"
      className={cn("flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1", className)}
      {...props}
    />
  )
}

function TimelineTitle({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="timeline-title" className={cn("min-w-0 text-sm font-medium", className)} {...props} />
}

function TimelineTime({ className, ...props }: React.ComponentProps<"time">) {
  return (
    <time
      data-slot="timeline-time"
      className={cn("text-xs whitespace-nowrap text-muted-foreground tabular-nums", className)}
      {...props}
    />
  )
}

function TimelineDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="timeline-description" className={cn("text-sm text-muted-foreground", className)} {...props} />
}

export {
  Timeline,
  TimelineItem,
  TimelineIcon,
  TimelineContent,
  TimelineHeader,
  TimelineTitle,
  TimelineTime,
  TimelineDescription,
  timelineIconVariants,
}

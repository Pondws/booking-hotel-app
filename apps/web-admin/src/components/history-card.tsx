"use client";

import type { AdminAuditLog, AuditChange } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@booking/ui/components/card";
import { Skeleton } from "@booking/ui/components/skeleton";
import {
  Timeline,
  TimelineContent,
  TimelineDescription,
  TimelineHeader,
  TimelineIcon,
  TimelineItem,
  TimelineTime,
  TimelineTitle,
} from "@booking/ui/components/timeline";
import { activityOf } from "@/features/audit-logs/activity";
import {
  ENTITY_LABELS,
  fieldLabel,
  formatDateTime,
  formatValue,
  isImageReorder,
} from "@/features/audit-logs/format";
import { useHistory, type HistoryFilter } from "@/features/audit-logs/hooks";

function ChangeValue({ change }: { change: AuditChange }) {
  if (isImageReorder(change)) return <span>เปลี่ยนรูปหรือลำดับรูป</span>;
  const before = formatValue(change.field, change.before);
  const after = formatValue(change.field, change.after);
  if (change.before === null) return <span>{after}</span>;
  if (change.after === null) return <span className="text-muted-foreground line-through">{before}</span>;
  return (
    <span>
      <span className="text-muted-foreground line-through">{before}</span>
      <span aria-hidden> → </span>
      <span className="sr-only"> เป็น </span>
      {after}
    </span>
  );
}

/** Rows about something other than the page's own entity (a room of this room type, one amenity) name it. */
function subjectOf(log: AdminAuditLog, filter: HistoryFilter): string | null {
  if (filter.entityId !== undefined && log.entityId === filter.entityId) return null;
  return filter.entityType === log.entityType ? log.entityLabel : `${ENTITY_LABELS[log.entityType]} ${log.entityLabel}`;
}

function HistoryItem({ log, filter }: { log: AdminAuditLog; filter: HistoryFilter }) {
  const activity = activityOf(log);
  const subject = subjectOf(log, filter);
  const Icon = activity.icon;
  return (
    <TimelineItem>
      <TimelineIcon variant={activity.variant}>
        <Icon />
      </TimelineIcon>
      <TimelineContent>
        <TimelineHeader>
          <TimelineTitle>
            {activity.label}
            {subject && <span className="font-normal"> {subject}</span>}
            <span className="font-normal text-muted-foreground"> · โดย {log.actor?.name ?? "บัญชีที่ถูกลบ"}</span>
          </TimelineTitle>
          <TimelineTime dateTime={log.createdAt}>{formatDateTime(log.createdAt)}</TimelineTime>
        </TimelineHeader>
        {log.changes.length > 0 && (
          <TimelineDescription>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-1 rounded-md bg-muted/50 p-3 sm:grid-cols-[minmax(0,10rem)_1fr]">
              {log.changes.map((change) => (
                <div key={change.field} className="contents">
                  <dt>{fieldLabel(change.field)}</dt>
                  <dd className="mb-1 min-w-0 break-words text-foreground sm:mb-0">
                    <ChangeValue change={change} />
                  </dd>
                </div>
              ))}
            </dl>
          </TimelineDescription>
        )}
      </TimelineContent>
    </TimelineItem>
  );
}

function HistorySkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="flex justify-between gap-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * "ประวัติการแก้ไข" card for a page: who changed what, and when, as a timeline (newest first).
 * `filter` = this page's entity (its children's rows come along, e.g. a room type's rooms and rates).
 */
export function HistoryCard({ filter, description }: { filter: HistoryFilter; description?: string }) {
  const { data, isPending, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } = useHistory(filter);
  const logs = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>ประวัติการแก้ไข</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-6">
        {isPending ? (
          <HistorySkeleton />
        ) : isError ? (
          <div role="alert" className="space-y-2">
            <p className="text-sm">โหลดประวัติการแก้ไขไม่สำเร็จ</p>
            <Button variant="outline" onClick={() => void refetch()}>
              ลองอีกครั้ง
            </Button>
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มีการแก้ไข</p>
        ) : (
          <>
            <Timeline aria-label="ประวัติการแก้ไข">
              {logs.map((log) => (
                <HistoryItem key={log.id} log={log} filter={filter} />
              ))}
            </Timeline>
            {hasNextPage && (
              <Button variant="outline" onClick={() => void fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage ? "กำลังโหลด…" : "ดูเพิ่มเติม"}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MessageCircle } from "lucide-react";
import {
  SUPPORT_MESSAGE_MAX,
  SUPPORT_TOPICS,
  createSupportRequestSchema,
  type CreateSupportRequestData,
  type CreateSupportRequestInput,
  type SupportRequest,
  type SupportTopic,
} from "@booking/shared";
import { Badge } from "@booking/ui/components/badge";
import { Button } from "@booking/ui/components/button";
import { Label } from "@booking/ui/components/label";
import { SelectField } from "@booking/ui/components/select-field";
import { Skeleton } from "@booking/ui/components/skeleton";
import { Textarea } from "@booking/ui/components/textarea";
import { applyServerFieldErrors, formErrorMessage } from "@/lib/form-errors";
import { thaiResolver } from "@/lib/messages-th";
import { useCreateSupportRequest, useSupportRequests } from "../hooks";

export const SUPPORT_TOPIC_LABEL: Record<SupportTopic, string> = {
  CHANGE_BOOKING: "เปลี่ยนแปลงการจอง",
  CANCELLATION: "การยกเลิกและคืนเงิน",
  PAYMENT: "การชำระเงิน",
  SPECIAL_REQUEST: "คำขอพิเศษ",
  OTHER: "เรื่องอื่น ๆ",
};

const TOPIC_OPTIONS = SUPPORT_TOPICS.map((value) => ({ value, label: SUPPORT_TOPIC_LABEL[value] }));

const dateTime = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" });

/** "Contact the team" on the booking page: past requests with staff replies, plus a new-message form. */
export function SupportCard({ code }: { code: string }) {
  const { data, isPending, isError, refetch, isFetching } = useSupportRequests(code);
  const [writing, setWriting] = useState(false);

  return (
    <section aria-labelledby="support-heading" className="space-y-4 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id="support-heading" className="flex items-center gap-2 text-lg font-semibold">
            <MessageCircle aria-hidden className="size-5" />
            ติดต่อทีมงาน
          </h2>
          <p className="text-sm text-muted-foreground">
            ทีมงานของโรงแรมจะเห็นการจองนี้และตอบกลับที่นี่ ดู<Link href="/help" className="underline underline-offset-4">คำถามที่พบบ่อย</Link>ก่อนได้
          </p>
        </div>
        {!writing && (
          <Button type="button" variant="outline" onClick={() => setWriting(true)}>
            ส่งข้อความ
          </Button>
        )}
      </div>

      {writing && <SupportForm code={code} onDone={() => setWriting(false)} />}

      {isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : isError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
          <span>โหลดข้อความไม่ได้ในขณะนี้</span>
          <Button size="sm" variant="outline" onClick={() => void refetch()} disabled={isFetching}>
            ลองใหม่
          </Button>
        </div>
      ) : data.length === 0 ? (
        !writing && <p className="text-sm text-muted-foreground">ยังไม่มีข้อความถึงทีมงานสำหรับการจองนี้</p>
      ) : (
        <ul className="space-y-3">
          {data.map((r) => (
            <RequestItem key={r.id} request={r} />
          ))}
        </ul>
      )}
    </section>
  );
}

function RequestItem({ request }: { request: SupportRequest }) {
  return (
    <li className="space-y-2 rounded-lg bg-muted/50 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{SUPPORT_TOPIC_LABEL[request.topic]}</span>
        {request.status === "OPEN" ? (
          <Badge variant="secondary">รอตอบกลับ</Badge>
        ) : (
          <Badge>ตอบแล้ว</Badge>
        )}
      </div>
      <p className="whitespace-pre-line">{request.message}</p>
      <p className="text-xs text-muted-foreground">{dateTime.format(new Date(request.createdAt))}</p>
      {request.reply && (
        <div className="space-y-1 border-l-2 border-primary pl-3">
          <p className="text-xs font-medium text-primary">ทีมงานตอบกลับ</p>
          <p className="whitespace-pre-line">{request.reply}</p>
          {request.resolvedAt && (
            <p className="text-xs text-muted-foreground">{dateTime.format(new Date(request.resolvedAt))}</p>
          )}
        </div>
      )}
    </li>
  );
}

function SupportForm({ code, onDone }: { code: string; onDone: () => void }) {
  const mutation = useCreateSupportRequest(code);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CreateSupportRequestInput, unknown, CreateSupportRequestData>({
    resolver: thaiResolver(zodResolver(createSupportRequestSchema)),
    defaultValues: { topic: "SPECIAL_REQUEST", message: "" },
  });
  const length = useWatch({ control, name: "message" })?.length ?? 0;
  const formError =
    mutation.isError && !Object.keys(errors).length ? formErrorMessage(mutation.error) : undefined;

  return (
    <form
      noValidate
      className="space-y-4 rounded-lg border p-4"
      onSubmit={handleSubmit((data) =>
        mutation.mutate(data, {
          onSuccess: onDone,
          onError: (err) => applyServerFieldErrors(err, setError, ["topic", "message"]),
        }),
      )}
    >
      <div className="space-y-2">
        <Label htmlFor="support-topic">เรื่อง</Label>
        <Controller
          control={control}
          name="topic"
          render={({ field }) => (
            <SelectField
              id="support-topic"
              className="w-full sm:w-64"
              options={TOPIC_OPTIONS}
              value={field.value}
              onValueChange={field.onChange}
            />
          )}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="support-message">ข้อความ</Label>
        <Textarea
          id="support-message"
          rows={4}
          maxLength={SUPPORT_MESSAGE_MAX}
          placeholder="เล่ารายละเอียดที่ต้องการให้ทีมงานช่วย"
          aria-invalid={!!errors.message}
          aria-describedby="support-message-count"
          {...register("message", { onChange: () => mutation.reset() })}
        />
        <div className="flex justify-between gap-4">
          <p className="text-sm text-destructive">{errors.message?.message}</p>
          <p id="support-message-count" className="text-xs text-muted-foreground tabular-nums">
            {length}/{SUPPORT_MESSAGE_MAX}
          </p>
        </div>
      </div>
      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "กำลังส่ง…" : "ส่งข้อความ"}
        </Button>
        <Button type="button" variant="ghost" disabled={mutation.isPending} onClick={onDone}>
          ยกเลิก
        </Button>
      </div>
    </form>
  );
}

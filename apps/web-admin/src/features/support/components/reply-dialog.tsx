"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  SUPPORT_MESSAGE_MAX,
  resolveSupportRequestSchema,
  type AdminSupportRequest,
  type ResolveSupportRequestData,
  type ResolveSupportRequestInput,
} from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@booking/ui/components/dialog";
import { Label } from "@booking/ui/components/label";
import { Textarea } from "@booking/ui/components/textarea";
import { applyServerFieldErrors, formErrorMessage } from "@/lib/form-errors";
import { thaiResolver } from "@/lib/messages-th";
import { useResolveSupportRequest } from "../hooks";
import { SUPPORT_TOPIC_LABEL } from "./topic-label";

/** Reply to a customer; sending it resolves the request (one answer per request). */
export function ReplyDialog({ request }: { request: AdminSupportRequest }) {
  const [open, setOpen] = useState(false);
  const mutation = useResolveSupportRequest(request.id);
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<ResolveSupportRequestInput, unknown, ResolveSupportRequestData>({
    resolver: thaiResolver(zodResolver(resolveSupportRequestSchema)),
    defaultValues: { reply: "" },
  });
  const length = useWatch({ control, name: "reply" })?.length ?? 0;
  const formError =
    mutation.isError && !Object.keys(errors).length ? formErrorMessage(mutation.error) : undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (mutation.isPending) return;
        if (next) {
          mutation.reset();
          reset({ reply: "" });
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          ตอบกลับ
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ตอบกลับ {request.booking.guestName}</DialogTitle>
          <DialogDescription>
            {SUPPORT_TOPIC_LABEL[request.topic]} · การจอง {request.booking.code} · {request.hotel.name}
          </DialogDescription>
        </DialogHeader>
        <p className="max-h-40 overflow-y-auto whitespace-pre-line rounded-md bg-muted p-3 text-sm">{request.message}</p>
        <form
          id={`reply-${request.id}`}
          noValidate
          className="space-y-2"
          onSubmit={handleSubmit((data) =>
            mutation.mutate(data, {
              onSuccess: () => setOpen(false),
              onError: (err) => applyServerFieldErrors(err, setError, ["reply"]),
            }),
          )}
        >
          <Label htmlFor={`reply-text-${request.id}`}>คำตอบ</Label>
          <Textarea
            id={`reply-text-${request.id}`}
            rows={5}
            maxLength={SUPPORT_MESSAGE_MAX}
            aria-invalid={!!errors.reply}
            aria-describedby={`reply-count-${request.id}`}
            {...register("reply", { onChange: () => mutation.reset() })}
          />
          <div className="flex justify-between gap-4">
            <p className="text-sm text-destructive">{errors.reply?.message}</p>
            <p id={`reply-count-${request.id}`} className="text-xs text-muted-foreground tabular-nums">
              {length}/{SUPPORT_MESSAGE_MAX}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">ลูกค้าจะเห็นคำตอบในหน้าการจอง และข้อความนี้จะเปลี่ยนเป็น “ตอบแล้ว”</p>
          {formError && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {formError}
            </p>
          )}
        </form>
        <DialogFooter>
          <Button type="button" variant="ghost" disabled={mutation.isPending} onClick={() => setOpen(false)}>
            ยกเลิก
          </Button>
          <Button type="submit" form={`reply-${request.id}`} disabled={mutation.isPending}>
            {mutation.isPending ? "กำลังส่ง…" : "ส่งคำตอบ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

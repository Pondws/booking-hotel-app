"use client";

import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CANCEL_REASON_MAX,
  cancelBookingInputSchema,
  type AdminBooking,
  type CancelBookingData,
  type CancelBookingInput,
} from "@booking/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@booking/ui/components/alert-dialog";
import { Button } from "@booking/ui/components/button";
import { Label } from "@booking/ui/components/label";
import { SelectField } from "@booking/ui/components/select-field";
import { Textarea } from "@booking/ui/components/textarea";
import { formatMoney } from "@/features/room-types/format";
import { applyServerFieldErrors, formErrorMessage } from "@/lib/form-errors";
import { thaiResolver } from "@/lib/messages-th";
import { useBookingRoomOptions, useCancelBooking, useCheckIn, useCheckOut, useMoveRoom } from "../hooks";

type Mutation = {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  reset: () => void;
};

/** AlertDialog that stays open while pending and to show a failure; closes on success. */
function ActionDialog({
  trigger,
  title,
  description,
  mutation,
  confirmLabel,
  pendingLabel,
  onConfirm,
  children,
  confirmDisabled = false,
}: {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  mutation: Mutation;
  confirmLabel: string;
  pendingLabel: string;
  onConfirm: (close: () => void) => void;
  children?: ReactNode;
  confirmDisabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (mutation.isPending) return;
        if (next) mutation.reset();
        setOpen(next);
      }}
    >
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        {mutation.isError && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {formErrorMessage(mutation.error)}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>ปิด</AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending || confirmDisabled}
            onClick={(event) => {
              event.preventDefault();
              onConfirm(() => setOpen(false));
            }}
          >
            {mutation.isPending ? pendingLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CheckInDialog({ booking }: { booking: AdminBooking }) {
  const mutation = useCheckIn(booking.code);
  return (
    <ActionDialog
      trigger={<Button>เช็คอิน</Button>}
      title={`เช็คอิน ${booking.guestName}?`}
      description={`ห้อง ${booking.room.number} · ${booking.roomType.name} · ${booking.guests} คน`}
      mutation={mutation}
      confirmLabel="เช็คอิน"
      pendingLabel="กำลังเช็คอิน…"
      onConfirm={(close) => mutation.mutate(undefined, { onSuccess: close })}
    />
  );
}

function CheckOutDialog({ booking }: { booking: AdminBooking }) {
  const mutation = useCheckOut(booking.code);
  return (
    <ActionDialog
      trigger={<Button>เช็คเอาท์</Button>}
      title={`เช็คเอาท์ ${booking.guestName}?`}
      description="การจองจะเปลี่ยนเป็นเช็คเอาท์แล้ว หากออกก่อนกำหนด คืนที่เหลือจะเปิดให้จองได้อีกครั้ง (ไม่คืนเงินอัตโนมัติ)"
      mutation={mutation}
      confirmLabel="เช็คเอาท์"
      pendingLabel="กำลังเช็คเอาท์…"
      onConfirm={(close) => mutation.mutate(undefined, { onSuccess: close })}
    />
  );
}

function CancelDialog({ booking }: { booking: AdminBooking }) {
  const mutation = useCancelBooking(booking.code);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CancelBookingInput, unknown, CancelBookingData>({
    resolver: thaiResolver(zodResolver(cancelBookingInputSchema)),
    defaultValues: { reason: "" },
  });
  const paid = booking.payment?.status === "SUCCEEDED";

  return (
    <ActionDialog
      trigger={<Button variant="outline">ยกเลิกการจอง</Button>}
      title={`ยกเลิกการจอง ${booking.code}?`}
      description={
        paid
          ? `ระบบจะคืนเงินเต็มจำนวน ${formatMoney(booking.totalAmount, booking.currency)} ให้ลูกค้า ยกเลิกแล้วย้อนกลับไม่ได้`
          : "ยกเลิกแล้วย้อนกลับไม่ได้ ห้องจะว่างให้จองได้อีกครั้ง"
      }
      mutation={{
        ...mutation,
        reset: () => {
          mutation.reset();
          reset();
        },
      }}
      confirmLabel="ยืนยันการยกเลิก"
      pendingLabel="กำลังยกเลิก…"
      onConfirm={(close) =>
        void handleSubmit((input) =>
          mutation.mutate(input, {
            onSuccess: close,
            onError: (error) => applyServerFieldErrors(error, setError, ["reason"]),
          }),
        )()
      }
    >
      <div className="space-y-2">
        <Label htmlFor="cancel-reason">เหตุผล</Label>
        <Textarea
          id="cancel-reason"
          rows={3}
          maxLength={CANCEL_REASON_MAX}
          placeholder="เช่น ลูกค้าโทรแจ้งยกเลิก, ไม่มาเข้าพัก"
          aria-invalid={errors.reason ? true : undefined}
          aria-describedby={errors.reason ? "cancel-reason-error" : undefined}
          {...register("reason")}
        />
        {errors.reason && (
          <p id="cancel-reason-error" className="text-sm text-destructive">
            {errors.reason.message}
          </p>
        )}
      </div>
    </ActionDialog>
  );
}

function MoveRoomDialog({ booking }: { booking: AdminBooking }) {
  const mutation = useMoveRoom(booking.code);
  // Room options load the first time the dialog opens (not with the page)
  const [requested, setRequested] = useState(false);
  const [roomId, setRoomId] = useState("");
  const rooms = useBookingRoomOptions(booking.code, requested);
  const options = rooms.data?.filter((r) => !r.current) ?? [];

  return (
    <ActionDialog
      trigger={
        <Button
          variant="outline"
          onClick={() => {
            setRequested(true);
            setRoomId("");
          }}
        >
          ย้ายห้อง
        </Button>
      }
      title="ย้ายไปห้องอื่น"
      description={`ห้องประเภท ${booking.roomType.name} ที่ว่างตลอดช่วงเข้าพัก (ตอนนี้: ห้อง ${booking.room.number})`}
      mutation={mutation}
      confirmLabel="ย้ายห้อง"
      pendingLabel="กำลังย้าย…"
      confirmDisabled={roomId === ""}
      onConfirm={(close) => mutation.mutate(roomId, { onSuccess: close })}
    >
      <div className="space-y-2">
        <Label htmlFor="move-room">ห้องใหม่</Label>
        {rooms.isPending ? (
          <p className="text-sm text-muted-foreground">กำลังโหลดห้อง…</p>
        ) : rooms.isError ? (
          <div role="alert" className="flex items-center gap-2">
            <p className="text-sm">โหลดรายการห้องไม่สำเร็จ</p>
            <Button variant="outline" size="sm" onClick={() => void rooms.refetch()}>
              ลองอีกครั้ง
            </Button>
          </div>
        ) : options.every((r) => !r.available) ? (
          <p className="text-sm text-muted-foreground">ไม่มีห้องอื่นในประเภทนี้ที่ว่างตลอดช่วงเข้าพัก</p>
        ) : (
          <SelectField
            id="move-room"
            className="w-full"
            placeholder="เลือกห้อง"
            options={options.map((r) => ({
              value: r.id,
              label: `ห้อง ${r.number}${!r.isActive ? " (ปิดใช้งาน)" : !r.available ? " (ไม่ว่าง)" : ""}`,
              disabled: !r.available,
            }))}
            value={roomId}
            onValueChange={setRoomId}
          />
        )}
      </div>
    </ActionDialog>
  );
}

/** Only the actions the API says are allowed right now (`can*` flags). */
export function BookingActions({ booking }: { booking: AdminBooking }) {
  const any = booking.canCheckIn || booking.canCheckOut || booking.canMoveRoom || booking.canCancel;
  if (!any) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {booking.canCheckIn && <CheckInDialog booking={booking} />}
      {booking.canCheckOut && <CheckOutDialog booking={booking} />}
      {booking.canMoveRoom && <MoveRoomDialog booking={booking} />}
      {booking.canCancel && <CancelDialog booking={booking} />}
    </div>
  );
}

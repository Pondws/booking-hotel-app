"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { resetStaffPasswordSchema, type AdminStaff } from "@booking/shared";
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
import { Badge } from "@booking/ui/components/badge";
import { Button } from "@booking/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@booking/ui/components/card";
import { Input } from "@booking/ui/components/input";
import { Separator } from "@booking/ui/components/separator";
import { Field } from "@/components/form-field";
import { applyServerFieldErrors, formErrorMessage } from "@/lib/form-errors";
import { thaiResolver } from "@/lib/messages-th";
import { useResetStaffPassword, useSetStaffActive } from "../hooks";

/** Sign-in access: deactivate / reactivate the account, and set a temporary password. */
export function StaffAccessCard({ staff }: { staff: AdminStaff }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          การเข้าสู่ระบบ
          <StaffStatusBadge isActive={staff.isActive} />
        </CardTitle>
        <CardDescription>
          {staff.isActive
            ? "ปิดบัญชีเมื่อพนักงานลาออก: ออกจากระบบทุกอุปกรณ์ทันทีและเข้าสู่ระบบไม่ได้อีก"
            : "บัญชีนี้ถูกปิดอยู่ เข้าสู่ระบบไม่ได้จนกว่าจะเปิดใช้งานอีกครั้ง"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <StaffActiveDialog staff={staff} />
        <Separator />
        <ResetPasswordForm staff={staff} />
      </CardContent>
    </Card>
  );
}

export function StaffStatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <Badge variant="secondary">ใช้งานอยู่</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      ปิดบัญชีแล้ว
    </Badge>
  );
}

function StaffActiveDialog({ staff }: { staff: AdminStaff }) {
  const [open, setOpen] = useState(false);
  const mutation = useSetStaffActive(staff.id);
  const deactivate = staff.isActive;
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (mutation.isPending) return;
        if (next) mutation.reset();
        setOpen(next);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" className={deactivate ? "text-destructive" : undefined}>
          {deactivate ? "ปิดบัญชี" : "เปิดใช้งานบัญชี"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{deactivate ? `ปิดบัญชีของ ${staff.name}?` : `เปิดใช้งานบัญชีของ ${staff.name}?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {deactivate
              ? "พนักงานจะถูกออกจากระบบทุกอุปกรณ์ทันที และเข้าสู่ระบบไม่ได้จนกว่าจะเปิดใช้งานอีกครั้ง โรงแรมที่ดูแลยังอยู่เหมือนเดิม"
              : "พนักงานจะเข้าสู่ระบบด้วยรหัสผ่านเดิมได้อีกครั้ง"}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {mutation.isError && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {formErrorMessage(mutation.error)}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>ยกเลิก</AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            className={deactivate ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
            onClick={(event) => {
              // Stay open to show a failure
              event.preventDefault();
              mutation.mutate(!deactivate, { onSuccess: () => setOpen(false) });
            }}
          >
            {mutation.isPending ? "กำลังบันทึก…" : deactivate ? "ปิดบัญชี" : "เปิดใช้งาน"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type ResetInput = z.input<typeof resetStaffPasswordSchema>;
type ResetOutput = z.output<typeof resetStaffPasswordSchema>;

/** The ADMIN types a temporary password and hands it over; the staff member is signed out everywhere. */
function ResetPasswordForm({ staff }: { staff: AdminStaff }) {
  const reset = useResetStaffPassword(staff.id);
  const {
    register,
    handleSubmit,
    setError,
    reset: resetForm,
    formState: { errors, isDirty },
  } = useForm<ResetInput, unknown, ResetOutput>({
    resolver: thaiResolver(zodResolver(resetStaffPasswordSchema)),
    defaultValues: { password: "" },
  });
  const formError = reset.isError && !errors.password ? formErrorMessage(reset.error) : undefined;

  return (
    <form
      noValidate
      aria-label="ตั้งรหัสผ่านชั่วคราว"
      className="max-w-sm space-y-4"
      onSubmit={handleSubmit(({ password }) => {
        reset.reset();
        reset.mutate(password, {
          onSuccess: () => resetForm({ password: "" }),
          onError: (err) => applyServerFieldErrors(err, setError, ["password"]),
        });
      })}
    >
      <Field
        id="staff-temp-password"
        label="ตั้งรหัสผ่านชั่วคราว (อย่างน้อย 8 ตัวอักษร)"
        error={errors.password?.message}
      >
        <Input
          id="staff-temp-password"
          type="text"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={!!errors.password}
          aria-describedby="staff-temp-password-hint"
          {...register("password")}
        />
      </Field>
      <p id="staff-temp-password-hint" className="text-sm text-muted-foreground">
        พนักงานจะถูกออกจากระบบทุกอุปกรณ์ แจ้งรหัสนี้ให้พนักงานแล้วให้เปลี่ยนเองที่หน้า “บัญชีของฉัน”
      </p>
      {formError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {formError}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="outline" disabled={!isDirty || reset.isPending}>
          {reset.isPending ? "กำลังตั้งรหัส…" : "ตั้งรหัสผ่านใหม่"}
        </Button>
        <p role="status" className="text-sm text-muted-foreground">
          {reset.isSuccess && !isDirty ? "ตั้งรหัสผ่านใหม่แล้ว" : ""}
        </p>
      </div>
    </form>
  );
}

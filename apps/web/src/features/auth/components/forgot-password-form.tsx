"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  PASSWORD_RESET_MINUTES,
  forgotPasswordSchema,
  type ForgotPasswordData,
  type ForgotPasswordInput,
} from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Input } from "@booking/ui/components/input";
import { Label } from "@booking/ui/components/label";
import { formErrorMessage } from "@/lib/form-errors";
import { thaiResolver } from "@/lib/messages-th";
import { useForgotPassword } from "../hooks";

/** Asks for a reset link. The API answers the same for any email, so the success copy never confirms an account. */
export function ForgotPasswordForm() {
  const forgot = useForgotPassword();
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<ForgotPasswordInput, unknown, ForgotPasswordData>({
    resolver: thaiResolver(zodResolver(forgotPasswordSchema)),
  });

  if (forgot.isSuccess) {
    return (
      <div role="status" className="space-y-4">
        <p className="text-sm">
          ถ้า <span className="font-medium">{getValues("email")}</span> มีบัญชีกับเรา
          เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปแล้ว ลิงก์ใช้ได้ครั้งเดียวภายใน {PASSWORD_RESET_MINUTES} นาที
        </p>
        <p className="text-sm text-muted-foreground">ไม่เห็นอีเมล? ตรวจโฟลเดอร์สแปม หรือขอลิงก์ใหม่อีกครั้ง</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => forgot.reset()}>
            ขอลิงก์ใหม่
          </Button>
          <Button asChild variant="ghost">
            <Link href="/login">กลับไปเข้าสู่ระบบ</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form noValidate className="space-y-4" onSubmit={handleSubmit((values) => forgot.mutate(values))}>
      <div className="space-y-2">
        <Label htmlFor="email">อีเมลที่ใช้สมัคร</Label>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>
      {forgot.isError && (
        <p role="alert" className="text-sm text-destructive">
          {formErrorMessage(forgot.error)}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={forgot.isPending}>
        {forgot.isPending ? "กำลังส่ง…" : "ส่งลิงก์ตั้งรหัสผ่านใหม่"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        นึกออกแล้ว?{" "}
        <Link href="/login" className="text-foreground underline underline-offset-4">
          เข้าสู่ระบบ
        </Link>
      </p>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordFormSchema, type ResetPasswordFormInput, type ResetPasswordInput } from "@booking/shared";
import { Button, buttonVariants } from "@booking/ui/components/button";
import { Input } from "@booking/ui/components/input";
import { Label } from "@booking/ui/components/label";
import { applyServerFieldErrors, formErrorMessage } from "@/lib/form-errors";
import { thaiResolver } from "@/lib/messages-th";
import { useResetPassword } from "../hooks";

type FormOutput = ResetPasswordInput & { confirmPassword: string };

/** `/reset-password?token=…` from the emailed link. Every device is signed out on success. */
export function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const reset = useResetPassword();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ResetPasswordFormInput, unknown, FormOutput>({
    resolver: thaiResolver(zodResolver(resetPasswordFormSchema)),
    defaultValues: { token, password: "", confirmPassword: "" },
  });

  if (!token) return <InvalidLink />;

  if (reset.isSuccess) {
    return (
      <div role="status" className="space-y-4">
        <p className="text-sm">ตั้งรหัสผ่านใหม่แล้ว เราออกจากระบบให้ในทุกอุปกรณ์ เข้าสู่ระบบอีกครั้งด้วยรหัสผ่านใหม่</p>
        <Link href="/login" className={buttonVariants({ className: "w-full" })}>
          เข้าสู่ระบบ
        </Link>
      </div>
    );
  }

  const tokenError = errors.token?.message;
  const formError = reset.isError && !errors.password && !errors.confirmPassword ? formErrorMessage(reset.error) : null;

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(({ token: t, password }) =>
        reset.mutate(
          { token: t, password },
          { onError: (error) => applyServerFieldErrors(error, setError, ["password"]) },
        ),
      )}
    >
      <input type="hidden" {...register("token")} />
      <div className="space-y-2">
        <Label htmlFor="password">รหัสผ่านใหม่</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          {...register("password", { onChange: () => reset.reset() })}
        />
        {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">ยืนยันรหัสผ่านใหม่</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.confirmPassword}
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
      </div>
      {(tokenError || formError) && (
        <div role="alert" className="space-y-1 text-sm text-destructive">
          <p>{tokenError ?? formError}</p>
          <Link href="/forgot-password" className="underline underline-offset-4">
            ขอลิงก์ใหม่
          </Link>
        </div>
      )}
      <Button type="submit" className="w-full" disabled={reset.isPending}>
        {reset.isPending ? "กำลังบันทึก…" : "ตั้งรหัสผ่านใหม่"}
      </Button>
    </form>
  );
}

function InvalidLink() {
  return (
    <div role="alert" className="space-y-4">
      <p className="text-sm">ลิงก์ไม่สมบูรณ์ เปิดลิงก์จากอีเมลอีกครั้ง หรือขอลิงก์ใหม่</p>
      <Link href="/forgot-password" className={buttonVariants({ variant: "outline", className: "w-full" })}>
        ขอลิงก์ใหม่
      </Link>
    </div>
  );
}

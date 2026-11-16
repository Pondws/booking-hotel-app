"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { changePasswordFormSchema, type ChangePasswordFormInput } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@booking/ui/components/card";
import { Input } from "@booking/ui/components/input";
import { Label } from "@booking/ui/components/label";
import { applyServerFieldErrors, formErrorMessage } from "@/lib/form-errors";
import { thaiResolver } from "@/lib/messages-th";
import { useChangePassword } from "../hooks";

type FormOutput = z.output<typeof changePasswordFormSchema>;

const EMPTY: ChangePasswordFormInput = { currentPassword: "", newPassword: "", confirmPassword: "" };

const FIELDS = [
  { name: "currentPassword", label: "รหัสผ่านปัจจุบัน", autoComplete: "current-password" },
  { name: "newPassword", label: "รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)", autoComplete: "new-password" },
  { name: "confirmPassword", label: "ยืนยันรหัสผ่านใหม่", autoComplete: "new-password" },
] as const;

/** The API keeps this session and signs out every other device. */
export function ChangePasswordForm() {
  const change = useChangePassword();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormInput, unknown, FormOutput>({
    resolver: thaiResolver(zodResolver(changePasswordFormSchema)),
    defaultValues: EMPTY,
  });

  const onSubmit = handleSubmit(({ currentPassword, newPassword }) => {
    setFormError(null);
    setDone(false);
    change.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          reset(EMPTY);
          setDone(true);
        },
        onError: (error) => {
          if (!applyServerFieldErrors(error, setError, ["currentPassword", "newPassword"])) {
            setFormError(formErrorMessage(error));
          }
        },
      },
    );
  });

  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle>
          <h2>เปลี่ยนรหัสผ่าน</h2>
        </CardTitle>
        <CardDescription>หลังเปลี่ยนแล้ว อุปกรณ์อื่นที่เข้าสู่ระบบอยู่จะถูกออกจากระบบทั้งหมด</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="max-w-sm space-y-4">
          {FIELDS.map(({ name, label, autoComplete }) => (
            <div key={name} className="space-y-2">
              <Label htmlFor={`password-${name}`}>{label}</Label>
              <Input
                id={`password-${name}`}
                type="password"
                autoComplete={autoComplete}
                aria-invalid={!!errors[name]}
                {...register(name)}
              />
              {errors[name] && <p className="text-sm text-destructive">{errors[name].message}</p>}
            </div>
          ))}
          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={change.isPending}>
              {change.isPending ? "กำลังเปลี่ยน…" : "เปลี่ยนรหัสผ่าน"}
            </Button>
            {done && (
              <p role="status" className="text-sm text-muted-foreground">
                เปลี่ยนรหัสผ่านแล้ว
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

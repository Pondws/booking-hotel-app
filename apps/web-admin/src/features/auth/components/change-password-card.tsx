"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { changePasswordFormSchema, type ChangePasswordFormInput } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@booking/ui/components/card";
import { Input } from "@booking/ui/components/input";
import { Field } from "@/components/form-field";
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

export function ChangePasswordCard() {
  const change = useChangePassword();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<ChangePasswordFormInput, unknown, FormOutput>({
    resolver: thaiResolver(zodResolver(changePasswordFormSchema)),
    defaultValues: EMPTY,
  });
  const formError =
    change.isError && !Object.keys(errors).length ? formErrorMessage(change.error) : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>เปลี่ยนรหัสผ่าน</CardTitle>
        <CardDescription>หลังเปลี่ยนแล้ว อุปกรณ์อื่นที่เข้าสู่ระบบอยู่จะถูกออกจากระบบทั้งหมด</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          aria-label="เปลี่ยนรหัสผ่าน"
          className="max-w-sm space-y-4"
          onSubmit={handleSubmit(({ currentPassword, newPassword }) => {
            change.reset();
            change.mutate(
              { currentPassword, newPassword },
              {
                onSuccess: () => reset(EMPTY),
                onError: (err) => applyServerFieldErrors(err, setError, ["currentPassword", "newPassword"]),
              },
            );
          })}
        >
          {FIELDS.map(({ name, label, autoComplete }) => (
            <Field key={name} id={`password-${name}`} label={label} error={errors[name]?.message}>
              <Input
                id={`password-${name}`}
                type="password"
                autoComplete={autoComplete}
                aria-invalid={!!errors[name]}
                {...register(name)}
              />
            </Field>
          ))}
          {formError && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {formError}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={change.isPending}>
              {change.isPending ? "กำลังเปลี่ยน…" : "เปลี่ยนรหัสผ่าน"}
            </Button>
            <p role="status" className="text-sm text-muted-foreground">
              {change.isSuccess && !isDirty ? "เปลี่ยนรหัสผ่านแล้ว" : ""}
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

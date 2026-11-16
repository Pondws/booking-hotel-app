"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { updateProfileSchema, type PublicUser } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@booking/ui/components/card";
import { Input } from "@booking/ui/components/input";
import { Label } from "@booking/ui/components/label";
import { applyServerFieldErrors, formErrorMessage } from "@/lib/form-errors";
import { thaiResolver } from "@/lib/messages-th";
import { useUpdateProfile } from "../hooks";

type FormInput = z.input<typeof updateProfileSchema>;
type FormOutput = z.output<typeof updateProfileSchema>;

/** Name + phone. Email can't change. On success the `me` cache (header, account page) updates in place. */
export function ProfileForm({ user }: { user: PublicUser }) {
  const update = useUpdateProfile();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: thaiResolver(zodResolver(updateProfileSchema)),
    defaultValues: { name: user.name, phone: user.phone ?? "" },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    update.mutate(values, {
      onSuccess: (saved) => reset({ name: saved.name, phone: saved.phone ?? "" }),
      onError: (error) => {
        if (!applyServerFieldErrors(error, setError, ["name", "phone"])) setFormError(formErrorMessage(error));
      },
    });
  });

  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle>
          <h2>ข้อมูลส่วนตัว</h2>
        </CardTitle>
        <CardDescription>อีเมล {user.email} (เปลี่ยนไม่ได้)</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="max-w-sm space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-name">ชื่อ</Label>
            <Input id="profile-name" autoComplete="name" aria-invalid={!!errors.name} {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-phone">เบอร์โทร</Label>
            <Input
              id="profile-phone"
              type="tel"
              autoComplete="tel"
              aria-invalid={!!errors.phone}
              {...register("phone")}
            />
            {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
          </div>
          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={update.isPending || !isDirty}>
              {update.isPending ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
            {update.isSuccess && !isDirty && (
              <p role="status" className="text-sm text-muted-foreground">
                บันทึกแล้ว
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

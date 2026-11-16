"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  updateProfileSchema,
  type PublicUser,
  type UpdateProfileData,
  type UpdateProfileInput,
} from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@booking/ui/components/card";
import { Input } from "@booking/ui/components/input";
import { Label } from "@booking/ui/components/label";
import { Field } from "@/components/form-field";
import { applyServerFieldErrors, formErrorMessage } from "@/lib/form-errors";
import { thaiResolver } from "@/lib/messages-th";
import { useUpdateProfile } from "../hooks";

const FIELDS = ["name", "phone"] as const;

const toValues = (user: PublicUser): UpdateProfileInput => ({ name: user.name, phone: user.phone ?? "" });

/** The signed-in user's own name + phone; saving updates `me` (sidebar name) in place. */
export function ProfileCard({ user }: { user: PublicUser }) {
  const update = useUpdateProfile();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateProfileInput, unknown, UpdateProfileData>({
    resolver: thaiResolver(zodResolver(updateProfileSchema)),
    defaultValues: toValues(user),
  });
  const formError =
    update.isError && !Object.keys(errors).length ? formErrorMessage(update.error) : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>ข้อมูลส่วนตัว</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          aria-label="ข้อมูลส่วนตัว"
          className="space-y-4"
          onSubmit={handleSubmit((data) => {
            update.reset();
            update.mutate(data, {
              onSuccess: (saved) => reset(toValues(saved)),
              onError: (err) => applyServerFieldErrors(err, setError, FIELDS),
            });
          })}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="profile-name" label="ชื่อ" error={errors.name?.message}>
              <Input id="profile-name" autoComplete="name" aria-invalid={!!errors.name} {...register("name")} />
            </Field>
            <Field id="profile-phone" label="เบอร์โทร (ไม่บังคับ)" error={errors.phone?.message}>
              <Input
                id="profile-phone"
                type="tel"
                autoComplete="tel"
                aria-invalid={!!errors.phone}
                {...register("phone")}
              />
            </Field>
            <div className="space-y-2">
              <Label htmlFor="profile-email">อีเมล (ใช้เข้าสู่ระบบ)</Label>
              <Input id="profile-email" value={user.email} readOnly disabled />
            </div>
          </div>
          {formError && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {formError}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={!isDirty || update.isPending}>
              {update.isPending ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
            <Button type="button" variant="ghost" disabled={!isDirty || update.isPending} onClick={() => reset()}>
              ยกเลิกการแก้ไข
            </Button>
            <p role="status" className="text-sm text-muted-foreground">
              {update.isSuccess && !isDirty ? "บันทึกแล้ว" : ""}
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

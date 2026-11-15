"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createStaffSchema, type CreateStaffData, type CreateStaffInput } from "@booking/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@booking/ui/components/card";
import { Input } from "@booking/ui/components/input";
import { Field } from "@/components/form-field";
import { FormHeader } from "@/components/form-header";
import { applyServerFieldErrors } from "@/lib/form-errors";
import { thaiResolver } from "@/lib/messages-th";
import { useCreateStaff } from "../hooks";

const FIELDS = ["name", "email", "password", "phone"] as const;

/** Creates a STAFF account, then opens its page to assign hotels. */
export function StaffCreateForm() {
  const router = useRouter();
  const create = useCreateStaff();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<CreateStaffInput, unknown, CreateStaffData>({
    resolver: thaiResolver(zodResolver(createStaffSchema)),
    defaultValues: { name: "", email: "", password: "", phone: "" },
  });
  const hasFieldError = FIELDS.some((f) => errors[f]?.type === "server");

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={handleSubmit((data) => {
        create.reset();
        create.mutate(data, {
          onSuccess: (staff) => router.push(`/staff/${staff.id}`),
          onError: (err) => applyServerFieldErrors(err, setError, FIELDS),
        });
      })}
    >
      <FormHeader
        heading={<h1 className="text-2xl font-semibold tracking-tight">เพิ่มพนักงาน</h1>}
        backHref="/staff"
        isCreate
        createLabel="สร้างบัญชีพนักงาน"
        isDirty={isDirty}
        isPending={create.isPending}
        isSuccess={create.isSuccess}
        error={create.error}
        hasFieldError={hasFieldError}
        onDiscard={() => reset()}
      />
      <Card>
        <CardHeader>
          <CardTitle>บัญชี</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field id="staff-name" label="ชื่อ" error={errors.name?.message}>
            <Input id="staff-name" autoComplete="off" aria-invalid={!!errors.name} {...register("name")} />
          </Field>
          <Field id="staff-phone" label="เบอร์โทร (ไม่บังคับ)" error={errors.phone?.message}>
            <Input
              id="staff-phone"
              type="tel"
              autoComplete="off"
              aria-invalid={!!errors.phone}
              {...register("phone")}
            />
          </Field>
          <Field id="staff-email" label="อีเมล" error={errors.email?.message}>
            <Input
              id="staff-email"
              type="email"
              autoComplete="off"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
          </Field>
          <Field id="staff-password" label="รหัสผ่านเริ่มต้น" error={errors.password?.message}>
            <Input
              id="staff-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              aria-describedby="staff-password-hint"
              {...register("password")}
            />
            <p id="staff-password-hint" className="text-sm text-muted-foreground">
              อย่างน้อย 8 ตัวอักษร แจ้งให้พนักงานทราบเพื่อเข้าสู่ระบบหลังบ้าน
            </p>
          </Field>
        </CardContent>
      </Card>
    </form>
  );
}

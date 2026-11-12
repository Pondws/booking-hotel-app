"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { loginSchema, safeNextPath } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Input } from "@booking/ui/components/input";
import { Label } from "@booking/ui/components/label";
import { ApiError } from "@/lib/api";
import { applyServerFieldErrors, formErrorMessage } from "@/lib/form-errors";
import { useLogin, useMe } from "../hooks";

type FormInput = z.input<typeof loginSchema>;
type FormOutput = z.output<typeof loginSchema>;

function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 403) return "Staff access only";
  if (error instanceof ApiError && error.status === 401) return "Invalid email or password";
  return formErrorMessage(error);
}

export function LoginForm() {
  const router = useRouter();
  const target = safeNextPath(useSearchParams().get("next"));
  const { data: me } = useMe();
  const login = useLogin();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(loginSchema) });

  // Signed in (already, or just now): leave the login page
  useEffect(() => {
    if (me) router.replace(target);
  }, [me, router, target]);

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    login.mutate(values, {
      onError: (error) => {
        if (!applyServerFieldErrors(error, setError, ["email", "password"])) {
          setFormError(loginErrorMessage(error));
        }
      },
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
        {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
      </div>
      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={login.isPending}>
        {login.isPending ? "Logging in…" : "Log in"}
      </Button>
    </form>
  );
}

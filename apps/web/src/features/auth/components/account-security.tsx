"use client";

import { useMe } from "../hooks";
import { ChangePasswordForm } from "./change-password-form";
import { ProfileForm } from "./profile-form";

/** Rendered inside `RequireAuth`, so `me` is already loaded. */
export function AccountSecurity() {
  const { data: user } = useMe();
  if (!user) return null;
  return (
    <div className="space-y-4">
      <ProfileForm user={user} />
      <ChangePasswordForm />
    </div>
  );
}

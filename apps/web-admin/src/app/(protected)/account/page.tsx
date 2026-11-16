"use client";

import { ChangePasswordCard } from "@/features/auth/components/change-password-card";
import { ProfileCard } from "@/features/auth/components/profile-card";
import { useMe } from "@/features/auth/hooks";

export default function AccountPage() {
  // RequireAuth (protected layout) already waited for `me`; null only during sign-out
  const { data: me } = useMe();
  return (
    <main className="w-full space-y-6 px-4 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">บัญชีของฉัน</h1>
        <p className="text-sm text-muted-foreground">แก้ไขข้อมูลส่วนตัวและเปลี่ยนรหัสผ่าน</p>
      </header>
      {me && (
        <>
          <ProfileCard key={me.id} user={me} />
          <ChangePasswordCard />
        </>
      )}
    </main>
  );
}

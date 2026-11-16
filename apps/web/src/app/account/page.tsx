import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountDetails } from "@/features/auth/components/account-details";
import { RequireAuth } from "@/features/auth/components/require-auth";

export const metadata: Metadata = { title: "บัญชีของฉัน · Booking Hotel" };

export default function AccountPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Suspense>
        <RequireAuth>
          <AccountDetails />
        </RequireAuth>
      </Suspense>
    </main>
  );
}

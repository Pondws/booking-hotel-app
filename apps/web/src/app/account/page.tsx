import { AccountDetails } from "@/features/auth/components/account-details";
import { RequireAuth } from "@/features/auth/components/require-auth";

export default function AccountPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-12">
      <RequireAuth>
        <AccountDetails />
      </RequireAuth>
    </main>
  );
}

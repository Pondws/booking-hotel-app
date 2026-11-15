import { AdminOnly } from "@/components/admin-only";
import { StaffCreateForm } from "@/features/staff/components/staff-create-form";

export default function NewStaffPage() {
  return (
    <main className="w-full space-y-6 px-4 py-8">
      <AdminOnly>
        <StaffCreateForm />
      </AdminOnly>
    </main>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { RequireAuth } from "@/features/auth/components/require-auth";
import { BookView } from "@/features/bookings/components/book-view";

export const metadata: Metadata = { title: "Book your stay · Booking Hotel" };

export default function BookPage() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Book your stay</h1>
      <Suspense>
        <RequireAuth>
          <BookView />
        </RequireAuth>
      </Suspense>
    </main>
  );
}

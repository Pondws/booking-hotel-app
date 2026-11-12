import { ApiStatus, HotelList } from "@/components/hotel-list";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Booking Hotel</h1>
          <p className="text-muted-foreground">Find a place to stay.</p>
        </div>
        <ApiStatus />
      </header>
      <HotelList />
    </main>
  );
}

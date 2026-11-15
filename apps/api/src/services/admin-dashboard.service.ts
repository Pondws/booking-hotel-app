import {
  BOOKING_TZ,
  DASHBOARD_DEFAULT_NIGHTS,
  nightsBetween,
  todayIn,
  type AdminDashboard,
  type AdminDashboardQuery,
  type AdminDashboardStay,
  type PublicUser,
} from "@booking/shared";
import type { BookingStatus, Prisma } from "../generated/prisma/client";
import { AppError } from "../lib/app-error";
import { eachNight, fromDbDate, toDbDate } from "../lib/dates";
import { toMinorUnits } from "../lib/money";
import { splitAcrossNights } from "../lib/night-split";
import { prisma } from "../lib/prisma";
import { canAccessHotel } from "./hotel-access.service";

/** Paid stays. PENDING / CANCELLED (refunded in full) / EXPIRED never count. */
const COUNTED: BookingStatus[] = ["CONFIRMED", "COMPLETED"];
const LIST_LIMIT = 20;
const MINOR_PER_MAJOR = 100;

function addDays(iso: string, days: number): string {
  const d = toDbDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fromDbDate(d);
}

/** Inclusive night range; a missing bound sits DASHBOARD_DEFAULT_NIGHTS − 1 nights from the other. */
function resolveRange(query: AdminDashboardQuery, today: string): { from: string; to: string } {
  const span = DASHBOARD_DEFAULT_NIGHTS - 1;
  if (query.from !== undefined && query.to !== undefined) return { from: query.from, to: query.to };
  if (query.from !== undefined) return { from: query.from, to: addDays(query.from, span) };
  const to = query.to ?? today;
  return { from: addDays(to, -span), to };
}

async function hotelScope(user: PublicUser, hotelId: string | undefined): Promise<Prisma.HotelWhereInput> {
  if (hotelId !== undefined) {
    if (!(await canAccessHotel(user, hotelId))) throw new AppError(403, "FORBIDDEN", "No access to this hotel");
    return { id: hotelId };
  }
  return user.role === "ADMIN" ? {} : { staff: { some: { userId: user.id } } };
}

const staySelect = {
  code: true,
  guestName: true,
  guests: true,
  checkIn: true,
  checkOut: true,
  status: true,
  checkedInAt: true,
  room: {
    select: {
      id: true,
      number: true,
      roomType: { select: { id: true, name: true, hotel: { select: { id: true, name: true } } } },
    },
  },
} satisfies Prisma.BookingSelect;
type StayRow = Prisma.BookingGetPayload<{ select: typeof staySelect }>;

function toStayList(rows: StayRow[], isDone: (row: StayRow) => boolean): AdminDashboard["arrivals"] {
  const items: AdminDashboardStay[] = rows.map((row) => ({
    code: row.code,
    guestName: row.guestName,
    guests: row.guests,
    nights: nightsBetween(fromDbDate(row.checkIn), fromDbDate(row.checkOut)),
    hotel: row.room.roomType.hotel,
    roomType: { id: row.room.roomType.id, name: row.room.roomType.name },
    room: { id: row.room.id, number: row.room.number },
    done: isDone(row),
  }));
  return { total: items.length, done: items.filter((s) => s.done).length, items: items.slice(0, LIST_LIMIT) };
}

export async function getAdminDashboard(
  user: PublicUser,
  query: AdminDashboardQuery,
  now: Date = new Date(),
): Promise<AdminDashboard> {
  const today = todayIn(BOOKING_TZ, now);
  const { from, to } = resolveRange(query, today);
  const dates = eachNight(from, addDays(to, 1));
  const hotel = await hotelScope(user, query.hotelId);
  const inScope = { room: { roomType: { hotel } } } satisfies Prisma.BookingWhereInput;
  const counted = { ...inScope, status: { in: COUNTED } } satisfies Prisma.BookingWhereInput;
  const byGuest = [{ guestName: "asc" }, { code: "asc" }] satisfies Prisma.BookingOrderByWithRelationInput[];

  const [hotelCount, roomCount, stays, arrivals, departures, inHouse] = await Promise.all([
    prisma.hotel.count({ where: hotel }),
    prisma.room.count({ where: { isActive: true, roomType: { isActive: true, hotel: { AND: [hotel, { isActive: true }] } } } }),
    prisma.booking.findMany({
      where: { ...counted, checkIn: { lte: toDbDate(to) }, checkOut: { gt: toDbDate(from) } },
      select: { checkIn: true, checkOut: true, totalAmount: true, currency: true },
    }),
    prisma.booking.findMany({ where: { ...counted, checkIn: toDbDate(today) }, select: staySelect, orderBy: byGuest }),
    prisma.booking.findMany({ where: { ...counted, checkOut: toDbDate(today) }, select: staySelect, orderBy: byGuest }),
    prisma.booking.count({ where: { ...inScope, status: "CONFIRMED", checkedInAt: { not: null } } }),
  ]);

  const sold = new Map<string, number>(dates.map((d) => [d, 0]));
  const revenue = new Map<string, Map<string, number>>(); // currency → date → minor units
  for (const stay of stays) {
    const nights = eachNight(fromDbDate(stay.checkIn), fromDbDate(stay.checkOut));
    const parts = splitAcrossNights(toMinorUnits(stay.totalAmount), nights.length);
    let perDate = revenue.get(stay.currency);
    if (!perDate) {
      perDate = new Map(dates.map((d) => [d, 0]));
      revenue.set(stay.currency, perDate);
    }
    nights.forEach((night, i) => {
      const count = sold.get(night);
      if (count === undefined) return; // outside the range
      sold.set(night, count + 1);
      perDate.set(night, perDate.get(night)! + parts[i]!);
    });
  }

  const rateOf = (n: number, available: number) => (available === 0 ? null : n / available);
  const roomNightsSold = [...sold.values()].reduce((a, b) => a + b, 0);
  const roomNightsAvailable = roomCount * dates.length;
  const toMajor = (minor: number) => minor / MINOR_PER_MAJOR;

  return {
    today,
    from,
    to,
    nights: dates.length,
    hotelCount,
    roomCount,
    arrivals: toStayList(arrivals, (row) => row.checkedInAt !== null),
    departures: toStayList(departures, (row) => row.status === "COMPLETED"),
    inHouse,
    occupancy: {
      roomNightsSold,
      roomNightsAvailable,
      rate: rateOf(roomNightsSold, roomNightsAvailable),
      daily: dates.map((date) => ({ date, sold: sold.get(date)!, rate: rateOf(sold.get(date)!, roomCount) })),
    },
    revenue: [...revenue.entries()]
      .map(([currency, perDate]) => {
        const daily = dates.map((date) => ({ date, minor: perDate.get(date)! }));
        const total = daily.reduce((a, d) => a + d.minor, 0);
        return { currency, total, daily };
      })
      .sort((a, b) => b.total - a.total)
      .map(({ currency, total, daily }) => ({
        currency,
        total: toMajor(total),
        daily: daily.map((d) => ({ date: d.date, amount: toMajor(d.minor) })),
      })),
  };
}

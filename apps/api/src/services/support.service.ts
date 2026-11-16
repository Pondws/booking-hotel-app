import {
  SUPPORT_OPEN_LIMIT,
  type AdminSupportListQuery,
  type AdminSupportRequest,
  type CreateSupportRequestData,
  type Paginated,
  type PublicUser,
  type ResolveSupportRequestData,
  type SupportRequest,
} from "@booking/shared";
import type { Prisma } from "../generated/prisma/client";
import { AppError } from "../lib/app-error";
import { fromDbDate } from "../lib/dates";
import { prisma } from "../lib/prisma";
import { canAccessHotel } from "./hotel-access.service";

const requestSelect = {
  id: true,
  topic: true,
  message: true,
  status: true,
  reply: true,
  resolvedAt: true,
  createdAt: true,
} satisfies Prisma.SupportRequestSelect;

type RequestRow = Prisma.SupportRequestGetPayload<{ select: typeof requestSelect }>;

function toSupportRequest(row: RequestRow): SupportRequest {
  return {
    ...row,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

const bookingNotFound = () => new AppError(404, "NOT_FOUND", "Booking not found");

/** The caller's own booking (another user's code = 404), with what a request copies from it. */
async function findOwnBooking(userId: string, code: string) {
  const booking = await prisma.booking.findFirst({
    where: { code, userId },
    select: { id: true, room: { select: { roomType: { select: { hotelId: true } } } } },
  });
  if (!booking) throw bookingNotFound();
  return booking;
}

/** Newest first. */
export async function listMySupportRequests(user: PublicUser, code: string): Promise<SupportRequest[]> {
  const booking = await findOwnBooking(user.id, code);
  const rows = await prisma.supportRequest.findMany({
    where: { bookingId: booking.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: requestSelect,
  });
  return rows.map(toSupportRequest);
}

/** Any of the user's bookings, any status (questions come after a stay too). User and hotel come from the booking. */
export async function createSupportRequest(
  user: PublicUser,
  code: string,
  data: CreateSupportRequestData,
): Promise<SupportRequest> {
  const booking = await findOwnBooking(user.id, code);
  const open = await prisma.supportRequest.count({ where: { bookingId: booking.id, status: "OPEN" } });
  if (open >= SUPPORT_OPEN_LIMIT) {
    throw new AppError(409, "CONFLICT", `You already have ${SUPPORT_OPEN_LIMIT} open requests for this booking`);
  }
  const row = await prisma.supportRequest.create({
    data: {
      bookingId: booking.id,
      userId: user.id,
      hotelId: booking.room.roomType.hotelId,
      topic: data.topic,
      message: data.message,
    },
    select: requestSelect,
  });
  return toSupportRequest(row);
}

// ---------- Admin ----------

const adminRequestSelect = {
  ...requestSelect,
  booking: { select: { code: true, guestName: true, guestEmail: true, checkIn: true, checkOut: true } },
  hotel: { select: { id: true, name: true } },
  resolvedBy: { select: { name: true } },
} satisfies Prisma.SupportRequestSelect;

type AdminRequestRow = Prisma.SupportRequestGetPayload<{ select: typeof adminRequestSelect }>;

function toAdminSupportRequest(row: AdminRequestRow): AdminSupportRequest {
  const { booking, hotel, resolvedBy, ...rest } = row;
  return {
    ...toSupportRequest(rest),
    booking: {
      code: booking.code,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      checkIn: fromDbDate(booking.checkIn),
      checkOut: fromDbDate(booking.checkOut),
    },
    hotel,
    resolvedBy,
  };
}

/** STAFF see only requests of hotels they are assigned to; ADMIN see all. */
function visibleWhere(user: PublicUser): Prisma.SupportRequestWhereInput {
  return user.role === "ADMIN" ? {} : { hotel: { staff: { some: { userId: user.id } } } };
}

export async function listAdminSupportRequests(
  user: PublicUser,
  query: AdminSupportListQuery,
): Promise<Paginated<AdminSupportRequest>> {
  const { hotelId, status, page, pageSize } = query;
  if (hotelId !== undefined && !(await canAccessHotel(user, hotelId))) {
    throw new AppError(403, "FORBIDDEN", "No access to this hotel");
  }
  const where: Prisma.SupportRequestWhereInput = {
    AND: [visibleWhere(user), status === "all" ? {} : { status }, hotelId !== undefined ? { hotelId } : {}],
  };
  const dir = status === "OPEN" ? "asc" : "desc";
  const [total, rows] = await prisma.$transaction([
    prisma.supportRequest.count({ where }),
    prisma.supportRequest.findMany({
      where,
      orderBy: [{ createdAt: dir }, { id: dir }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: adminRequestSelect,
    }),
  ]);
  return {
    items: rows.map(toAdminSupportRequest),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Answers once: a single conditional update, so two staff replying at the same time can't both win. */
export async function resolveSupportRequest(
  user: PublicUser,
  requestId: string,
  data: ResolveSupportRequestData,
  now: Date = new Date(),
): Promise<AdminSupportRequest> {
  const visible = { AND: [{ id: requestId }, visibleWhere(user)] } satisfies Prisma.SupportRequestWhereInput;
  const { count } = await prisma.supportRequest.updateMany({
    where: { AND: [visible, { status: "OPEN" }] },
    data: { status: "RESOLVED", reply: data.reply, resolvedAt: now, resolvedById: user.id },
  });
  const row = await prisma.supportRequest.findFirst({ where: visible, select: adminRequestSelect });
  if (!row) throw new AppError(404, "NOT_FOUND", "Support request not found");
  if (count === 0) throw new AppError(409, "CONFLICT", "This request has already been answered");
  return toAdminSupportRequest(row);
}

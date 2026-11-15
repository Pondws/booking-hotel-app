import type {
  AdminStaff,
  AdminStaffListQuery,
  AdminStaffSummary,
  CreateStaffData,
  Paginated,
  PublicUser,
  UpdateStaffData,
} from "@booking/shared";
import type { Prisma } from "../generated/prisma/client";
import { AppError } from "../lib/app-error";
import { hashPassword } from "../lib/password";
import { isUniqueViolationOn } from "../lib/prisma-errors";
import { prisma } from "../lib/prisma";
import { recordAudit, staffSnapshot } from "./audit.service";

const hotelOrder = [{ hotel: { name: "asc" } }, { hotelId: "asc" }] as const satisfies
  Prisma.HotelStaffOrderByWithRelationInput[];

const staffSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  createdAt: true,
  updatedAt: true,
  staffOf: {
    orderBy: [...hotelOrder],
    select: { hotel: { select: { id: true, name: true, city: true, isActive: true } } },
  },
} as const satisfies Prisma.UserSelect;

type StaffRow = Prisma.UserGetPayload<{ select: typeof staffSelect }>;

function toAdminStaff(u: StaffRow): AdminStaff {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    hotels: u.staffOf.map((s) => s.hotel),
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

const notFound = () => new AppError(404, "NOT_FOUND", "Staff member not found");

export async function listStaff(query: AdminStaffListQuery): Promise<Paginated<AdminStaffSummary>> {
  const { q, page, pageSize } = query;
  const where: Prisma.UserWhereInput = {
    role: "STAFF",
    ...(q !== undefined && {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    }),
  };
  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        staffOf: { orderBy: [...hotelOrder], select: { hotel: { select: { id: true, name: true } } } },
      },
    }),
  ]);
  return {
    items: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      hotels: u.staffOf.map((s) => s.hotel),
      createdAt: u.createdAt.toISOString(),
    })),
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}

/** Only STAFF users are exposed here; an ADMIN / CUSTOMER id is a 404. */
export async function getStaff(userId: string): Promise<AdminStaff> {
  const user = await prisma.user.findFirst({ where: { id: userId, role: "STAFF" }, select: staffSelect });
  if (!user) throw notFound();
  return toAdminStaff(user);
}

/** Reads the staff member as they are now, records the change from `before` (null = just created). Staff rows are ADMIN only, so no hotel. */
async function auditStaff(actor: PublicUser, userId: string, before: AdminStaff | null): Promise<AdminStaff> {
  const after = await getStaff(userId);
  await recordAudit({
    actor,
    entityType: "STAFF",
    entityId: userId,
    entityLabel: after.name,
    hotelId: null,
    before: before && staffSnapshot(before),
    after: staffSnapshot(after),
  });
  return after;
}

export async function createStaff(actor: PublicUser, data: CreateStaffData): Promise<AdminStaff> {
  const passwordHash = await hashPassword(data.password);
  let userId: string;
  try {
    const user = await prisma.user.create({
      data: { name: data.name, email: data.email, phone: data.phone, passwordHash, role: "STAFF" },
      select: { id: true },
    });
    userId = user.id;
  } catch (err) {
    if (isUniqueViolationOn(err, "email")) {
      const message = "Email already registered";
      throw new AppError(409, "CONFLICT", message, { formErrors: [], fieldErrors: { email: [message] } });
    }
    throw err;
  }
  return auditStaff(actor, userId, null);
}

export async function updateStaff(actor: PublicUser, userId: string, data: UpdateStaffData): Promise<AdminStaff> {
  const before = await getStaff(userId);
  const { count } = await prisma.user.updateMany({
    where: { id: userId, role: "STAFF" },
    data: { name: data.name, phone: data.phone },
  });
  if (count === 0) throw notFound();
  return auditStaff(actor, userId, before);
}

export async function assignHotel(actor: PublicUser, userId: string, hotelId: string): Promise<AdminStaff> {
  const before = await getStaff(userId);
  const hotel = await prisma.hotel.count({ where: { id: hotelId } });
  if (hotel === 0) throw new AppError(404, "NOT_FOUND", "Hotel not found");
  const existing = await prisma.hotelStaff.count({ where: { userId, hotelId } });
  if (existing > 0) throw new AppError(409, "CONFLICT", "This staff member already works at this hotel");
  // A concurrent duplicate hits @@unique([userId, hotelId]) → P2002 → 409 from the error handler.
  await prisma.hotelStaff.create({ data: { userId, hotelId }, select: { id: true } });
  return auditStaff(actor, userId, before);
}

/** Access ends on the next request — `canAccessHotel` reads `HotelStaff` every time. */
export async function removeHotel(actor: PublicUser, userId: string, hotelId: string): Promise<void> {
  const before = await getStaff(userId);
  const { count } = await prisma.hotelStaff.deleteMany({ where: { userId, hotelId } });
  if (count === 0) throw new AppError(404, "NOT_FOUND", "This staff member doesn't work at this hotel");
  await auditStaff(actor, userId, before);
}

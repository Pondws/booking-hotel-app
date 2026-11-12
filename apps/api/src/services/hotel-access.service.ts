import type { PublicUser } from "@booking/shared";
import { prisma } from "../lib/prisma";

/** ADMIN can access every hotel; STAFF only hotels they are assigned to. */
export async function canAccessHotel(user: PublicUser, hotelId: string): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  if (user.role !== "STAFF") return false;
  const count = await prisma.hotelStaff.count({
    where: { userId: user.id, hotelId },
  });
  return count > 0;
}

import { randomInt } from "node:crypto";

/** No 0/O/1/I, so codes survive being read aloud or copied by hand. */
export const BOOKING_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

/** `BK` + 6 chars from `BOOKING_CODE_ALPHABET`; `random(max)` returns an int in `[0, max)`. */
export function generateBookingCode(random: (max: number) => number = randomInt): string {
  let code = "BK";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += BOOKING_CODE_ALPHABET.charAt(random(BOOKING_CODE_ALPHABET.length));
  }
  return code;
}

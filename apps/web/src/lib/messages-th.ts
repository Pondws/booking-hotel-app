import type { FieldValues, Resolver } from "react-hook-form";

/**
 * The customer site is Thai, but `@booking/shared` schemas and the API speak English (web-admin translates
 * its own copy). Known messages are translated here; anything unknown falls back to the original.
 */
const EXACT: Record<string, string> = {
  // @booking/shared validation
  "Name is required": "กรุณากรอกชื่อ",
  "Password is required": "กรุณากรอกรหัสผ่าน",
  "Password must be at least 8 characters": "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร",
  "At least 1 guest": "อย่างน้อย 1 คน",
  "Enter 1 to 20 guests": "กรอกจำนวนผู้เข้าพัก 1–20 คน",
  "Check-in can't be in the past": "วันเช็คอินต้องไม่เป็นวันที่ผ่านมาแล้ว",
  "Check-out must be after check-in": "วันเช็คเอาท์ต้องอยู่หลังวันเช็คอิน",
  "Choose both check-in and check-out": "กรุณาเลือกทั้งวันเช็คอินและวันเช็คเอาท์",
  "Pick a rating": "กรุณาให้คะแนน",
  // API
  "Authentication required": "กรุณาเข้าสู่ระบบ",
  "Invalid email or password": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  "Email already registered": "อีเมลนี้มีบัญชีอยู่แล้ว",
  "Hotel not found": "ไม่พบโรงแรม",
  "Room type not found": "ไม่พบประเภทห้อง",
  "Booking not found": "ไม่พบการจอง",
  "Review not found": "ไม่พบรีวิว",
  "Route not found": "ไม่พบปลายทางที่ร้องขอ",
  "Resource not found": "ไม่พบข้อมูล",
  "Resource already exists": "มีข้อมูลนี้อยู่แล้ว",
  "Validation failed": "ข้อมูลไม่ถูกต้อง",
  "Malformed JSON body": "คำขอไม่ถูกต้อง",
  "Invalid request body": "คำขอไม่ถูกต้อง",
  "Internal server error": "เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่อีกครั้ง",
  "Too many attempts, try again later": "พยายามหลายครั้งเกินไป กรุณาลองใหม่ภายหลัง",
  "This booking can't be cancelled": "ยกเลิกการจองนี้ไม่ได้แล้ว",
  "This booking can't be paid": "ชำระเงินสำหรับการจองนี้ไม่ได้แล้ว",
  "This room was just booked for these dates": "ห้องนี้เพิ่งถูกจองไปในช่วงวันที่นี้",
  "This booking already has a review": "การจองนี้รีวิวไปแล้ว",
  "Only completed stays can be reviewed": "รีวิวได้เฉพาะการเข้าพักที่เสร็จสิ้นแล้ว",
  // lib/api.ts
  "Cannot reach the server": "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้",
  "Unexpected response from server": "เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง",
};

const PATTERNS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^At most (\d+) characters$/, (m) => `ไม่เกิน ${m[1]} ตัวอักษร`],
  [/^Use at most (\d+) characters$/, (m) => `ไม่เกิน ${m[1]} ตัวอักษร`],
  [/^Stays are limited to (\d+) nights$/, (m) => `เข้าพักได้ไม่เกิน ${m[1]} คืน`],
  [/^You have (\d+) bookings waiting for payment$/, (m) => `คุณมีการจองที่รอชำระเงินอยู่ ${m[1]} รายการแล้ว`],
  [/^Request failed with status (\d+)$/, (m) => `คำขอล้มเหลว (สถานะ ${m[1]})`],
];

/** Thai version of a known English message; the message itself otherwise. */
export function toThai(message: string): string {
  const exact = EXACT[message];
  if (exact !== undefined) return exact;
  for (const [pattern, render] of PATTERNS) {
    const match = message.match(pattern);
    if (match) return render(match);
  }
  return message;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function translateErrors(node: unknown): void {
  if (!isRecord(node)) return;
  for (const [key, value] of Object.entries(node)) {
    if (key === "ref") continue; // DOM element
    if (key === "message" && typeof value === "string") node[key] = toThai(value);
    else translateErrors(value);
  }
}

/** Wraps a resolver (e.g. `zodResolver(schema)`) so its field messages come out in Thai. */
export function thaiResolver<T extends FieldValues, C, O>(resolver: Resolver<T, C, O>): Resolver<T, C, O> {
  return async (values, context, options) => {
    const result = await resolver(values, context, options);
    translateErrors(result.errors);
    return result;
  };
}

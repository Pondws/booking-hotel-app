import type { FieldValues, Resolver } from "react-hook-form";
import { formatDateRange } from "@/features/room-types/format";

/**
 * The back-office is Thai, but `@booking/shared` schemas and the API speak English (the customer site
 * uses them too). Known messages are translated here; anything unknown falls back to the original.
 */
const EXACT: Record<string, string> = {
  // @booking/shared validation
  "Name is required": "กรุณากรอกชื่อ",
  "City is required": "กรุณากรอกเมือง",
  "Address is required": "กรุณากรอกที่อยู่",
  "Password is required": "กรุณากรอกรหัสผ่าน",
  "Password must be at least 8 characters": "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร",
  "Use HH:mm (24-hour)": "ใช้รูปแบบ HH:mm (24 ชั่วโมง)",
  "Nothing to update": "ไม่มีข้อมูลที่ต้องบันทึก",
  "Each image URL must be unique": "URL ของรูปภาพต้องไม่ซ้ำกัน",
  "Each amenity can only be added once": "เลือกสิ่งอำนวยความสะดวกแต่ละรายการได้ครั้งเดียว",
  "Enter a price": "กรุณากรอกราคา",
  "Price can't be negative": "ราคาต้องไม่ติดลบ",
  "Price is too high": "ราคาสูงเกินไป",
  "Use at most 2 decimal places": "ใช้ทศนิยมได้ไม่เกิน 2 ตำแหน่ง",
  "Enter how many guests": "กรุณากรอกจำนวนผู้เข้าพัก",
  "Use a whole number": "กรุณากรอกจำนวนเต็ม",
  "At least 1 guest": "อย่างน้อย 1 คน",
  "Room number is required": "กรุณากรอกหมายเลขห้อง",
  "Use letters, digits and - only": "ใช้ได้เฉพาะตัวอักษรภาษาอังกฤษ ตัวเลข และ -",
  "Pick the dates": "กรุณาเลือกวันที่",
  "The end date must be after the start date": "วันสิ้นสุดต้องอยู่หลังวันเริ่มต้น",
  "Code is required": "กรุณากรอกรหัส",
  "Use lowercase letters, digits, - and _ only": "ใช้ได้เฉพาะตัวพิมพ์เล็กภาษาอังกฤษ ตัวเลข - และ _",
  "Choose a hotel": "กรุณาเลือกโรงแรม",
  // API
  "Authentication required": "กรุณาเข้าสู่ระบบ",
  "Invalid email or password": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  "Insufficient permissions": "คุณไม่มีสิทธิ์ทำรายการนี้",
  "No access to this hotel": "คุณไม่มีสิทธิ์เข้าถึงโรงแรมนี้",
  "Staff access only": "สำหรับพนักงานและผู้ดูแลระบบเท่านั้น",
  "Hotel not found": "ไม่พบโรงแรม",
  "Room type not found": "ไม่พบประเภทห้อง",
  "Room not found": "ไม่พบห้อง",
  "Rate period not found": "ไม่พบช่วงราคา",
  "Route not found": "ไม่พบปลายทางที่ร้องขอ",
  "Resource not found": "ไม่พบข้อมูล",
  "Resource already exists": "มีข้อมูลนี้อยู่แล้ว",
  "Validation failed": "ข้อมูลไม่ถูกต้อง",
  "Malformed JSON body": "คำขอไม่ถูกต้อง",
  "Invalid request body": "คำขอไม่ถูกต้อง",
  "Internal server error": "เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่อีกครั้ง",
  "Too many attempts, try again later": "พยายามหลายครั้งเกินไป กรุณาลองใหม่ภายหลัง",
  "This room type has rooms or rates, so it can't be deleted. Deactivate it instead.":
    "ประเภทห้องนี้มีห้องหรือช่วงราคาอยู่ จึงลบไม่ได้ ให้ปิดใช้งานแทน",
  "Only hotel amenities can be added": "เลือกได้เฉพาะสิ่งอำนวยความสะดวกของโรงแรม",
  "Only room amenities can be added": "เลือกได้เฉพาะสิ่งอำนวยความสะดวกของห้อง",
  "Upload a JPEG, PNG or WebP image": "กรุณาอัปโหลดรูปภาพ JPEG, PNG หรือ WebP",
  "The file is empty": "ไฟล์ว่างเปล่า",
  "The file isn't a valid image of that type": "ไฟล์ไม่ใช่รูปภาพที่ถูกต้องตามประเภท",
  "These dates overlap another rate period": "วันที่ทับซ้อนกับช่วงราคาอื่น",
  "Enter a reason": "กรุณากรอกเหตุผล",
  "Choose a room": "กรุณาเลือกห้อง",
  "End date must be on or after the start date": "วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น",
  "Booking not found": "ไม่พบการจอง",
  "This booking can't be checked in": "เช็คอินการจองนี้ไม่ได้ สถานะหรือวันที่ไม่ตรงเงื่อนไข",
  "This booking can't be checked out": "เช็คเอาท์การจองนี้ไม่ได้ ผู้เข้าพักยังไม่ได้เช็คอิน",
  "This booking can't be cancelled": "ยกเลิกการจองนี้ไม่ได้แล้ว",
  "This booking can't be moved": "ย้ายห้องของการจองนี้ไม่ได้แล้ว",
  "This room isn't available for this stay": "ห้องนี้ไม่ว่างในช่วงวันที่เข้าพักนี้",
  "Email already registered": "อีเมลนี้มีบัญชีอยู่แล้ว",
  "Staff member not found": "ไม่พบพนักงาน",
  "This staff member already works at this hotel": "พนักงานคนนี้ดูแลโรงแรมนี้อยู่แล้ว",
  "This staff member doesn't work at this hotel": "พนักงานคนนี้ไม่ได้ดูแลโรงแรมนี้",
  "Amenity not found": "ไม่พบสิ่งอำนวยความสะดวก",
  "Review not found": "ไม่พบรีวิว",
};

const ISO = String.raw`(\d{4}-\d{2}-\d{2})`;

const PATTERNS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^At most (\d+) characters$/, (m) => `ไม่เกิน ${m[1]} ตัวอักษร`],
  [/^Use at most (\d+) characters$/, (m) => `ไม่เกิน ${m[1]} ตัวอักษร`],
  [/^At most (\d+) guests$/, (m) => `ไม่เกิน ${m[1]} คน`],
  [/^A rate period can cover at most (\d+) nights$/, (m) => `ช่วงราคาหนึ่งครอบคลุมได้ไม่เกิน ${m[1]} คืน`],
  [/^Room (.+) already exists in this hotel$/, (m) => `ห้อง ${m[1]} มีอยู่แล้วในโรงแรมนี้`],
  [/^The code "(.+)" is already used$/, (m) => `รหัส "${m[1]}" ถูกใช้แล้ว`],
  [
    new RegExp(`^These dates overlap (?:"(.+)"|another rate period) \\(${ISO} to ${ISO}\\)$`),
    (m) =>
      `วันที่ทับซ้อนกับ${m[1] ? ` "${m[1]}"` : "ช่วงราคาอื่น"} (${formatDateRange(m[2] ?? "", m[3] ?? "")})`,
  ],
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

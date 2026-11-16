import {
  BOOKING_TZ,
  type AuditChange,
  type AuditEntityType,
  type AuditValue,
} from "@booking/shared";
import { SCOPE_LABEL } from "@/features/amenities/components/scope-label";
import { PROMOTION_TYPE_LABEL } from "@/features/promotions/components/promotion-type-label";
import { PAYMENT_LABELS, STAGE_LABELS } from "@/features/bookings/components/booking-badges";
import { formatDate } from "@/features/room-types/format";

export const ENTITY_LABELS: Record<AuditEntityType, string> = {
  HOTEL: "โรงแรม",
  ROOM_TYPE: "ประเภทห้อง",
  ROOM: "ห้อง",
  RATE_PERIOD: "ช่วงราคา",
  AMENITY: "สิ่งอำนวยความสะดวก",
  STAFF: "พนักงาน",
  BOOKING: "การจอง",
  REVIEW: "รีวิว",
  PROMOTION: "โปรโมชัน",
};

/** Snapshot field names (from the API's audit snapshots) → Thai labels. Unknown fields show as is. */
const FIELD_LABELS: Record<string, string> = {
  name: "ชื่อ",
  city: "เมือง",
  address: "ที่อยู่",
  description: "รายละเอียด",
  checkInTime: "เวลาเช็คอิน",
  checkOutTime: "เวลาเช็คเอาท์",
  isActive: "การใช้งาน",
  images: "รูปภาพ",
  amenities: "สิ่งอำนวยความสะดวก",
  capacity: "จำนวนผู้เข้าพักสูงสุด",
  basePrice: "ราคาพื้นฐาน",
  number: "เลขห้อง",
  startDate: "วันเริ่ม",
  endDate: "วันสิ้นสุด",
  price: "ราคา",
  code: "รหัส",
  scope: "ใช้กับ",
  email: "อีเมล",
  phone: "เบอร์โทร",
  hotels: "โรงแรมที่ดูแล",
  status: "สถานะ",
  room: "ห้อง",
  cancelReason: "เหตุผลการยกเลิก",
  paymentStatus: "การชำระเงิน",
  isHidden: "การแสดงผล",
  password: "รหัสผ่าน",
  type: "ประเภท",
  percentOff: "ส่วนลด (%)",
  minNights: "จำนวนคืนขั้นต่ำ",
  minDaysAhead: "จองล่วงหน้าอย่างน้อย (วัน)",
  maxDaysAhead: "เข้าพักภายใน (วัน)",
  validFrom: "จองได้ตั้งแต่",
  validUntil: "จองได้ถึง",
};

export const fieldLabel = (field: string) => FIELD_LABELS[field] ?? field;

const EMPTY = "—";
const number = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });

function lookup(labels: Record<string, string>, value: string): string {
  return labels[value] ?? value;
}

/** One side of a change, as text. Empty values ("", [], null) read "—". */
export function formatValue(field: string, value: AuditValue): string {
  if (value === null || value === "" || (Array.isArray(value) && value.length === 0)) return EMPTY;
  if (Array.isArray(value)) return field === "images" ? `${value.length} รูป` : value.join(", ");
  if (typeof value === "boolean") {
    if (field === "isActive") return value ? "เปิดใช้งาน" : "ปิดใช้งาน";
    if (field === "isHidden") return value ? "ซ่อน" : "แสดง";
    return value ? "ใช่" : "ไม่";
  }
  if (typeof value === "number") return number.format(value);
  switch (field) {
    case "status":
      return lookup(STAGE_LABELS, value);
    case "paymentStatus":
      return lookup(PAYMENT_LABELS, value);
    case "password":
      return value === "reset" ? "ตั้งใหม่แล้ว" : value;
    case "scope":
      return lookup(SCOPE_LABEL, value);
    case "type":
      return lookup(PROMOTION_TYPE_LABEL, value);
    case "startDate":
    case "endDate":
    case "validFrom":
    case "validUntil":
      return formatDate(value);
    default:
      return value;
  }
}

/** Same number of images on both sides means they were swapped or reordered — "3 รูป → 3 รูป" says nothing. */
export function isImageReorder(change: AuditChange): boolean {
  return (
    change.field === "images" &&
    Array.isArray(change.before) &&
    Array.isArray(change.after) &&
    change.before.length === change.after.length
  );
}

const dateTime = new Intl.DateTimeFormat("th-TH", {
  timeZone: BOOKING_TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** `16 พ.ย. 2569 14:05` (Bangkok time) */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

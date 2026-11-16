import type { PromotionType } from "@booking/shared";

export const PROMOTION_TYPE_LABEL: Record<PromotionType, string> = {
  EARLY_BIRD: "จองล่วงหน้า",
  LAST_MINUTE: "นาทีสุดท้าย",
  LONG_STAY: "พักยาว",
  CODE: "โค้ดส่วนลด",
};

/** What each type needs, shown under the type select. */
export const PROMOTION_TYPE_HINT: Record<PromotionType, string> = {
  EARLY_BIRD: "ลดให้เมื่อจองก่อนวันเข้าพักอย่างน้อยตามจำนวนวันที่กำหนด",
  LAST_MINUTE: "ลดให้เมื่อวันเข้าพักอยู่ภายในจำนวนวันที่กำหนดนับจากวันจอง",
  LONG_STAY: "ลดให้เมื่อพักตั้งแต่จำนวนคืนที่กำหนดขึ้นไป",
  CODE: "ลดให้เฉพาะลูกค้าที่กรอกโค้ดตอนจอง",
};

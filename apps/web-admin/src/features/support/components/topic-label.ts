import type { SupportTopic } from "@booking/shared";

export const SUPPORT_TOPIC_LABEL: Record<SupportTopic, string> = {
  CHANGE_BOOKING: "เปลี่ยนแปลงการจอง",
  CANCELLATION: "การยกเลิกและคืนเงิน",
  PAYMENT: "การชำระเงิน",
  SPECIAL_REQUEST: "คำขอพิเศษ",
  OTHER: "เรื่องอื่น ๆ",
};

"use client";

import { Badge } from "@booking/ui/components/badge";
import { useHealth } from "../hooks";

export function ApiStatus() {
  const { data, isPending, isError } = useHealth();
  if (isPending) return <Badge variant="secondary">กำลังตรวจสอบ API…</Badge>;
  if (isError) return <Badge variant="destructive">API ออฟไลน์</Badge>;
  return <Badge variant={data.db ? "default" : "destructive"}>{data.db ? "API + DB ออนไลน์" : "DB ออฟไลน์"}</Badge>;
}

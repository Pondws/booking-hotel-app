"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@booking/ui/components/tabs";

/**
 * "รายละเอียด | ประวัติการแก้ไข" tabs of a detail page. The parts can sit anywhere under `DetailTabs`
 * (e.g. the list inside a form's sticky header):
 *
 * <DetailTabs>
 *   <header>…<DetailTabsList /></header>
 *   <DetailsPanel>…</DetailsPanel>
 *   <HistoryPanel><HistoryCard … /></HistoryPanel>
 * </DetailTabs>
 */
export function DetailTabs({ children }: { children: ReactNode }) {
  return (
    <Tabs defaultValue="details" className="gap-6">
      {children}
    </Tabs>
  );
}

export function DetailTabsList({ detailsLabel = "รายละเอียด" }: { detailsLabel?: string }) {
  return (
    <TabsList>
      <TabsTrigger value="details">{detailsLabel}</TabsTrigger>
      <TabsTrigger value="history">ประวัติการแก้ไข</TabsTrigger>
    </TabsList>
  );
}

/** Stays mounted while hidden, so unsaved form edits survive a look at the history. */
export function DetailsPanel({ children }: { children: ReactNode }) {
  return (
    <TabsContent value="details" forceMount className="space-y-6 data-[state=inactive]:hidden">
      {children}
    </TabsContent>
  );
}

export function HistoryPanel({ children }: { children: ReactNode }) {
  return <TabsContent value="history">{children}</TabsContent>;
}

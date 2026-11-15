"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@booking/ui/components/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@booking/ui/components/chart";
import { formatDate } from "@/features/room-types/format";
import { formatShortDate, niceTicks } from "../format";

export type DailyPoint = { date: string; value: number | null };

/** One series of nightly bars; a single series needs no legend — the card title names it. */
export function DailyChart({
  title,
  description,
  seriesLabel,
  color,
  data,
  formatValue,
  formatTick,
  minMax,
}: {
  title: string;
  description: string;
  seriesLabel: string;
  /** A theme token, e.g. `var(--chart-1)`. */
  color: string;
  data: DailyPoint[];
  formatValue: (value: number) => string;
  formatTick?: (value: number) => string;
  /** Lowest upper bound for the Y axis (1 = 100% for rates) so an empty range doesn't stretch the scale. */
  minMax?: number;
}) {
  const config = { value: { label: seriesLabel, color } } satisfies ChartConfig;
  const ticks = niceTicks(Math.max(minMax ?? 0, ...data.map((d) => d.value ?? 0)));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-auto h-64 w-full" aria-hidden>
          <BarChart data={data} margin={{ left: 4, right: 4 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              tickFormatter={formatShortDate}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={56}
              ticks={ticks}
              domain={[0, ticks[ticks.length - 1] ?? 1]}
              tickFormatter={(v: number) => (formatTick ?? formatValue)(v)}
            />
            <ChartTooltip
              cursor
              content={
                <ChartTooltipContent
                  labelFormatter={(label) => (typeof label === "string" ? formatDate(label) : label)}
                  formatter={(value) => (
                    <span className="flex w-full items-center justify-between gap-4">
                      <span className="text-muted-foreground">{seriesLabel}</span>
                      <span className="font-medium tabular-nums">
                        {typeof value === "number" ? formatValue(value) : "–"}
                      </span>
                    </span>
                  )}
                />
              }
            />
            <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
        <table className="sr-only">
          <caption>{title}</caption>
          <thead>
            <tr>
              <th scope="col">วันที่</th>
              <th scope="col">{seriesLabel}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.date}>
                <td>{formatDate(d.date)}</td>
                <td>{d.value === null ? "–" : formatValue(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

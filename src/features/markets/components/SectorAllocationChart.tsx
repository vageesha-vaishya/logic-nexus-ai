/**
 * Sector Allocation Chart
 *
 * Shows portfolio sector allocation as a Treemap (recharts) alongside a
 * comparison table of portfolio weight vs Nifty 50 benchmark weight.
 */

import { useMemo } from "react";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/design-system";
import type { HoldingWithPrice } from "../types";
import { getSector, NIFTY50_SECTOR_WEIGHTS } from "../utils/nse-sectors";

// ── Types ────────────────────────────────────────────────────────────────────

interface SectorRow {
  sector: string;
  value: number;
  weight: number;        // % of portfolio
  niftyWeight: number;   // % Nifty 50 benchmark
  delta: number;         // portfolio weight − nifty weight
}

// ── Colors ───────────────────────────────────────────────────────────────────

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
  "#14b8a6", "#a855f7",
];

// ── Custom Treemap cell content ───────────────────────────────────────────────

function CustomTreemapContent(props: any) {
  const { x, y, width, height, index, name, weight, colors } = props;
  const color = (colors as string[])[index % (colors as string[]).length];
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        stroke="#fff"
        strokeWidth={2}
        rx={4}
      />
      {width > 60 && height > 30 && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - 6}
            textAnchor="middle"
            fill="#fff"
            fontSize={12}
            fontWeight={600}
          >
            {name}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 10}
            textAnchor="middle"
            fill="rgba(255,255,255,0.8)"
            fontSize={11}
          >
            {(weight as number)?.toFixed(1)}%
          </text>
        </>
      )}
    </g>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface SectorAllocationChartProps {
  holdings: HoldingWithPrice[];
}

export function SectorAllocationChart({ holdings }: SectorAllocationChartProps) {
  const { sectorData, treemapData } = useMemo(() => {
    // Only include holdings that have a price and positive quantity
    const priced = holdings.filter((h) => h.last_price != null && h.qty > 0);

    if (priced.length === 0) return { sectorData: [], treemapData: [] };

    // Aggregate value by sector
    const sectorMap: Record<string, number> = {};
    let totalValue = 0;

    for (const h of priced) {
      const currentValue = h.qty * (h.last_price as number);
      const sector = getSector(h.instrument?.symbol ?? "");
      sectorMap[sector] = (sectorMap[sector] ?? 0) + currentValue;
      totalValue += currentValue;
    }

    if (totalValue === 0) return { sectorData: [], treemapData: [] };

    // Build sorted rows
    const rows: SectorRow[] = Object.entries(sectorMap)
      .map(([sector, value]) => {
        const weight = (value / totalValue) * 100;
        const niftyWeight = NIFTY50_SECTOR_WEIGHTS[sector] ?? 0;
        return {
          sector,
          value,
          weight,
          niftyWeight,
          delta: weight - niftyWeight,
        };
      })
      .sort((a, b) => b.value - a.value);

    const tData = rows.map((r) => ({
      name: r.sector,
      size: r.value,
      weight: r.weight,
    }));

    return { sectorData: rows, treemapData: tData };
  }, [holdings]);

  if (holdings.length === 0) {
    return (
      <EmptyState
        title="No holdings"
        description="Add holdings to see sector allocation."
      />
    );
  }

  if (sectorData.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-sm text-muted-foreground">
            Holdings have no current prices — sector allocation unavailable.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* ── Treemap ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sector Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <ResponsiveContainer width="100%" height={300}>
            <Treemap
              data={treemapData}
              dataKey="size"
              aspectRatio={4 / 3}
              content={<CustomTreemapContent colors={COLORS} />}
            >
              <Tooltip
                formatter={(v: number) => [
                  `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
                  "Value",
                ]}
              />
            </Treemap>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Comparison table ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">vs Nifty 50</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">Sector</th>
                <th className="px-4 py-2.5 text-right font-medium">Portfolio</th>
                <th className="px-4 py-2.5 text-right font-medium">Nifty 50</th>
                <th className="px-4 py-2.5 text-right font-medium">Δ</th>
              </tr>
            </thead>
            <tbody>
              {sectorData.map((row, idx) => {
                const deltaColor =
                  row.niftyWeight === 0
                    ? "text-muted-foreground"
                    : row.delta > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400";

                return (
                  <tr
                    key={row.sector}
                    className="border-b last:border-0 hover:bg-muted/40 transition-colors"
                  >
                    <td className="px-4 py-2.5 flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                      <span className="truncate">{row.sector}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                      {row.weight.toFixed(1)}%
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {row.niftyWeight > 0 ? `${row.niftyWeight.toFixed(1)}%` : "—"}
                    </td>
                    <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${deltaColor}`}>
                      {row.niftyWeight === 0
                        ? "—"
                        : `${row.delta >= 0 ? "+" : ""}${row.delta.toFixed(1)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

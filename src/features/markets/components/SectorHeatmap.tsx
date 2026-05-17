/**
 * SectorHeatmap — treemap-style visualization of NSE sector performance.
 *
 * Each cell is color-coded by change_pct:
 *   > +2%   → dark green  (#16a34a)
 *   > +0.5% → light green (#4ade80)
 *   > -0.5% → neutral     (#94a3b8)
 *   > -2%   → light red   (#f87171)
 *   <= -2%  → dark red    (#dc2626)
 *   null    → muted       (#475569)
 */

import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import type { SectorData } from "../hooks/useMarketBreadth";

// ── Helpers ────────────────────────────────────────────────────────────────────

function sectorColor(changePct: number | null): string {
  if (changePct === null || changePct === undefined) return "#475569";
  if (changePct > 2) return "#16a34a";
  if (changePct > 0.5) return "#4ade80";
  if (changePct > -0.5) return "#94a3b8";
  if (changePct > -2) return "#f87171";
  return "#dc2626";
}

function textColorForBg(changePct: number | null): string {
  // Dark backgrounds (dark green / dark red / muted) → white
  // Light backgrounds (light green / light red / neutral) → dark
  if (changePct === null || changePct === undefined) return "#ffffff";
  if (changePct > 2) return "#ffffff";
  if (changePct > 0.5) return "#14532d";
  if (changePct > -0.5) return "#1e293b";
  if (changePct > -2) return "#7f1d1d";
  return "#ffffff";
}

function fmtPct(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

// ── Custom Cell Content ────────────────────────────────────────────────────────

interface CustomContentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  change_pct?: number | null;
  ltp?: number | null;
}

function CustomContent(props: CustomContentProps) {
  const { x = 0, y = 0, width = 0, height = 0, name = "", change_pct, ltp } = props;

  const bg = sectorColor(change_pct ?? null);
  const fg = textColorForBg(change_pct ?? null);
  const pctStr = fmtPct(change_pct ?? null);

  // Only render text when cell is large enough
  if (width < 40 || height < 32) {
    return <rect x={x} y={y} width={width} height={height} fill={bg} stroke="#0f172a" strokeWidth={1} rx={2} />;
  }

  // Split long sector names at a space near the middle
  const words = name.split(" ");
  let line1 = name;
  let line2 = "";
  if (words.length > 1 && width < 120) {
    const mid = Math.ceil(words.length / 2);
    line1 = words.slice(0, mid).join(" ");
    line2 = words.slice(mid).join(" ");
  }

  const fontSize = Math.min(12, Math.max(9, Math.floor(width / 9)));
  const pctFontSize = Math.min(13, Math.max(9, Math.floor(width / 8)));
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  const hasLtp = ltp !== null && ltp !== undefined;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={bg}
        stroke="#0f172a"
        strokeWidth={1}
        rx={2}
      />
      {/* Sector name line 1 */}
      <text
        x={centerX}
        y={line2 ? centerY - (hasLtp ? 16 : 10) : centerY - (hasLtp ? 10 : 6)}
        textAnchor="middle"
        fill={fg}
        fontSize={fontSize}
        fontWeight={500}
        style={{ userSelect: "none", pointerEvents: "none" }}
      >
        {line1}
      </text>
      {/* Sector name line 2 (if wrapped) */}
      {line2 && (
        <text
          x={centerX}
          y={centerY - (hasLtp ? 4 : 0) + (hasLtp ? 0 : 4)}
          textAnchor="middle"
          fill={fg}
          fontSize={fontSize}
          fontWeight={500}
          style={{ userSelect: "none", pointerEvents: "none" }}
        >
          {line2}
        </text>
      )}
      {/* Change % */}
      <text
        x={centerX}
        y={line2 ? centerY + (hasLtp ? 10 : 16) : centerY + (hasLtp ? 6 : 12)}
        textAnchor="middle"
        fill={fg}
        fontSize={pctFontSize}
        fontWeight={700}
        style={{ userSelect: "none", pointerEvents: "none" }}
      >
        {pctStr}
      </text>
      {/* LTP */}
      {hasLtp && height > 64 && (
        <text
          x={centerX}
          y={line2 ? centerY + 26 : centerY + 22}
          textAnchor="middle"
          fill={fg}
          fontSize={Math.max(8, fontSize - 1)}
          opacity={0.85}
          style={{ userSelect: "none", pointerEvents: "none" }}
        >
          {ltp!.toLocaleString("en-IN")}
        </text>
      )}
    </g>
  );
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────────

interface TooltipPayload {
  payload?: {
    sector?: string;
    change_pct?: number | null;
    ltp?: number | null;
    ticker?: string;
  };
}

function HeatmapTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  const bg = sectorColor(d.change_pct ?? null);

  return (
    <div className="bg-popover border rounded-lg p-3 shadow-md text-xs min-w-[140px] space-y-1">
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: bg }} />
        <span className="font-semibold text-foreground">{d.sector ?? "—"}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Change</span>
        <span
          className="font-bold tabular-nums"
          style={{ color: bg === "#94a3b8" ? "hsl(var(--foreground))" : bg }}
        >
          {fmtPct(d.change_pct ?? null)}
        </span>
      </div>
      {d.ltp !== null && d.ltp !== undefined && (
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">LTP</span>
          <span className="font-medium tabular-nums">{d.ltp.toLocaleString("en-IN")}</span>
        </div>
      )}
      {d.ticker && (
        <div className="text-muted-foreground pt-0.5">{d.ticker}</div>
      )}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

interface SectorHeatmapProps {
  sectors: SectorData[];
  height?: number;
}

export function SectorHeatmap({ sectors, height = 400 }: SectorHeatmapProps) {
  const treeData = sectors.map((s) => ({
    name: s.sector,
    size: 1,
    sector: s.sector,
    ticker: s.ticker,
    change_pct: s.change_pct,
    ltp: s.ltp,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <Treemap
        data={treeData}
        dataKey="size"
        aspectRatio={4 / 3}
        stroke="#0f172a"
        content={<CustomContent />}
      >
        <Tooltip content={<HeatmapTooltip />} />
      </Treemap>
    </ResponsiveContainer>
  );
}

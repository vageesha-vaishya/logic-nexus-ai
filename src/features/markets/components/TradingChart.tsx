/**
 * TradingChart — TradingView Lightweight Charts v5 candlestick chart.
 *
 * Features:
 *   • Candlestick series (green up / red down) or Heikin Ashi mode
 *   • Volume histogram on a separate (hidden) price scale
 *   • Optional MA lines (20, 50, 200) toggled via "MA" button
 *   • Bollinger Bands (upper/lower dashed blue, middle solid thin blue)
 *   • VWAP line (purple dashed)
 *   • SuperTrend overlay (green when up, red when down)
 *   • Heikin Ashi chart type toggle
 *   • Timeframe toolbar: 1D · 5D · 1M · 3M · 6M · 1Y · All
 *   • Responsive via ResizeObserver
 *   • Loading / error overlay
 */

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  ColorType,
} from "lightweight-charts";
import type {
  IChartApi,
  ISeriesApi,
  DeepPartial,
  ChartOptions,
} from "lightweight-charts";
import { RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";
import { useDarkMode } from "@/components/system/DarkModeToggle";
import { useChartData } from "../hooks/useChartData";
import type { ChartInterval } from "../hooks/useChartData";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TradingChartProps {
  symbol:             string;
  exchange?:          string;        // default "NSE"
  height?:            number;        // default 420
  showVolume?:        boolean;       // default true
  showMA?:            boolean;       // default false — toggleable
  defaultInterval?:   ChartInterval; // default "1d"
  defaultIndicators?: string[];      // e.g. ["bb", "vwap", "supertrend"]
  className?:         string;
  title?:             string;        // shown in top-left corner
}

// ── Timeframe presets ─────────────────────────────────────────────────────────

const TIMEFRAME_PRESETS = [
  { label: "1D",  interval: "5m"  as ChartInterval, lookback: 1    },
  { label: "5D",  interval: "15m" as ChartInterval, lookback: 5    },
  { label: "1M",  interval: "1h"  as ChartInterval, lookback: 30   },
  { label: "3M",  interval: "1d"  as ChartInterval, lookback: 91   },
  { label: "6M",  interval: "1d"  as ChartInterval, lookback: 182  },
  { label: "1Y",  interval: "1d"  as ChartInterval, lookback: 365  },
  { label: "All", interval: "1w"  as ChartInterval, lookback: 1825 },
] as const;

const MA_COLORS: Record<string, string> = {
  "20":  "#F59E0B",   // amber
  "50":  "#3B82F6",   // blue
  "200": "#8B5CF6",   // purple
};

// ── Indicator series refs shape ───────────────────────────────────────────────

interface IndicatorSeriesRefs {
  bbUpper?:    ISeriesApi<"Line">;
  bbMiddle?:   ISeriesApi<"Line">;
  bbLower?:    ISeriesApi<"Line">;
  vwap?:       ISeriesApi<"Line">;
  stSegments?: ISeriesApi<"Line">[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TradingChart({
  symbol,
  exchange          = "NSE",
  height            = 420,
  showVolume        = true,
  showMA            = false,
  defaultInterval,
  defaultIndicators = [],
  className,
  title,
}: TradingChartProps) {
  const [selectedTF, setSelectedTF]   = useState("1Y");
  const [tfState, setTfState]         = useState<{ interval: ChartInterval; lookback: number }>({
    interval: defaultInterval ?? "1d",
    lookback: 365,
  });
  const [showMaLines, setShowMaLines] = useState(showMA ?? false);
  const [chartType, setChartType]     = useState<"candle" | "heikin_ashi">("candle");
  const [indicators, setIndicators]   = useState<Set<string>>(
    () => new Set(defaultIndicators),
  );

  // ── Refs ──────────────────────────────────────────────────────────────────
  const chartContainerRef   = useRef<HTMLDivElement>(null);
  const chartRef            = useRef<IChartApi | null>(null);
  const candleSeriesRef     = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef     = useRef<ISeriesApi<"Histogram"> | null>(null);
  const maSeriesRefs        = useRef<Record<string, ISeriesApi<"Line">>>({});
  const indicatorSeriesRefs = useRef<IndicatorSeriesRefs>({});

  // ── Derive query params ───────────────────────────────────────────────────
  const indicatorParam = (() => {
    const parts: string[] = [];
    if (chartType === "heikin_ashi") parts.push("ha");
    indicators.forEach(ind => parts.push(ind));
    return parts.join(",");
  })();

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data, isLoading, isError, error } = useChartData(
    symbol,
    exchange,
    tfState.interval,
    tfState.lookback,
    showMaLines ? "20,50,200" : "",
    { indicators: indicatorParam },
  );

  // ── Dark mode reactivity ─────────────────────────────────────────────────
  const isDark = useDarkMode();

  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor:  isDark ? "#D1D5DB" : "#374151",
      },
      grid: {
        vertLines: { color: isDark ? "#374151" : "#F3F4F6" },
        horzLines: { color: isDark ? "#374151" : "#F3F4F6" },
      },
      rightPriceScale: { borderColor: isDark ? "#4B5563" : "#E5E7EB" },
      timeScale:       { borderColor: isDark ? "#4B5563" : "#E5E7EB" },
    });
  }, [isDark]);

  // ── Chart init (mount only) ───────────────────────────────────────────────
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor:  isDark ? "#D1D5DB" : "#374151",
      },
      grid: {
        vertLines: { color: isDark ? "#374151" : "#F3F4F6" },
        horzLines: { color: isDark ? "#374151" : "#F3F4F6" },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: isDark ? "#4B5563" : "#E5E7EB" },
      timeScale: {
        borderColor:    isDark ? "#4B5563" : "#E5E7EB",
        timeVisible:    true,
        secondsVisible: false,
      },
      width:  chartContainerRef.current.clientWidth,
      height: height,
    } as DeepPartial<ChartOptions>);

    // Candlestick series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor:       "#10B981",
      downColor:     "#EF4444",
      borderVisible: false,
      wickUpColor:   "#10B981",
      wickDownColor: "#EF4444",
    });
    candleSeriesRef.current = candleSeries;

    // Volume histogram on a separate (hidden) price scale
    if (showVolume) {
      const volSeries = chart.addSeries(HistogramSeries, {
        color:        "#93C5FD",
        priceFormat:  { type: "volume" },
        priceScaleId: "volume",
      });
      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
        visible: false,
      });
      volumeSeriesRef.current = volSeries;
    }

    chartRef.current = chart;

    // ResizeObserver for responsive width
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    observer.observe(chartContainerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current            = null;
      candleSeriesRef.current     = null;
      volumeSeriesRef.current     = null;
      maSeriesRefs.current        = {};
      indicatorSeriesRefs.current = {};
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helper: remove all indicator series ──────────────────────────────────
  function _removeIndicatorSeries(chart: IChartApi) {
    const refs = indicatorSeriesRefs.current;
    const scalarKeys: (keyof IndicatorSeriesRefs)[] = ["bbUpper", "bbMiddle", "bbLower", "vwap"];
    for (const key of scalarKeys) {
      const s = refs[key] as ISeriesApi<"Line"> | undefined;
      if (s) {
        try { chart.removeSeries(s); } catch { /* already removed */ }
        delete refs[key];
      }
    }
    if (refs.stSegments) {
      for (const s of refs.stSegments) {
        try { chart.removeSeries(s); } catch { /* already removed */ }
      }
      delete refs.stSegments;
    }
  }

  // ── Data update effect ────────────────────────────────────────────────────
  useEffect(() => {
    if (!data || !candleSeriesRef.current) return;

    candleSeriesRef.current.setData(data.bars);

    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.setData(
        data.bars.map(b => ({
          time:  b.time,
          value: b.volume,
          color: b.close >= b.open ? "#6EE7B7" : "#FCA5A5",
        })),
      );
    }

    const chart = chartRef.current;
    if (!chart) return;

    // ── MA lines ───────────────────────────────────────────────────────────
    if (showMaLines && data.ma) {
      Object.values(maSeriesRefs.current).forEach(s => {
        try { chart.removeSeries(s); } catch { /* series may already be gone */ }
      });
      maSeriesRefs.current = {};

      Object.entries(data.ma).forEach(([period, points]) => {
        const lineSeries = chart.addSeries(LineSeries, {
          color:                   MA_COLORS[period] ?? "#9CA3AF",
          lineWidth:               1,
          priceLineVisible:        false,
          lastValueVisible:        false,
          crosshairMarkerVisible:  false,
        });
        lineSeries.setData(points);
        maSeriesRefs.current[period] = lineSeries;
      });
    } else if (!showMaLines) {
      Object.values(maSeriesRefs.current).forEach(s => {
        try { chart.removeSeries(s); } catch { /* ignore */ }
      });
      maSeriesRefs.current = {};
    }

    // ── Indicator overlay series — always rebuild from scratch ─────────────
    _removeIndicatorSeries(chart);

    // Bollinger Bands
    if (data.bollinger && indicators.has("bb")) {
      const bbUpper = chart.addSeries(LineSeries, {
        color:                  "#93c5fd",
        lineWidth:              1,
        lineStyle:              2, // dashed
        lastValueVisible:       false,
        priceLineVisible:       false,
        crosshairMarkerVisible: false,
      });
      bbUpper.setData(data.bollinger.upper);
      indicatorSeriesRefs.current.bbUpper = bbUpper;

      const bbMiddle = chart.addSeries(LineSeries, {
        color:                  "#3b82f6",
        lineWidth:              1,
        lineStyle:              0, // solid
        lastValueVisible:       false,
        priceLineVisible:       false,
        crosshairMarkerVisible: false,
      });
      bbMiddle.setData(data.bollinger.middle);
      indicatorSeriesRefs.current.bbMiddle = bbMiddle;

      const bbLower = chart.addSeries(LineSeries, {
        color:                  "#93c5fd",
        lineWidth:              1,
        lineStyle:              2, // dashed
        lastValueVisible:       false,
        priceLineVisible:       false,
        crosshairMarkerVisible: false,
      });
      bbLower.setData(data.bollinger.lower);
      indicatorSeriesRefs.current.bbLower = bbLower;
    }

    // VWAP
    if (data.vwap && indicators.has("vwap")) {
      const vwapSeries = chart.addSeries(LineSeries, {
        color:                  "#a855f7",
        lineWidth:              1,
        lineStyle:              2, // dashed
        lastValueVisible:       false,
        priceLineVisible:       false,
        crosshairMarkerVisible: false,
      });
      vwapSeries.setData(data.vwap);
      indicatorSeriesRefs.current.vwap = vwapSeries;
    }

    // SuperTrend — one LineSeries per contiguous direction segment
    if (data.supertrend && indicators.has("supertrend") && data.supertrend.length > 0) {
      const stData = data.supertrend;
      type STPoint = { time: string | number; value: number };
      const segments: { direction: "up" | "down"; points: STPoint[] }[] = [];

      let currentDir    = stData[0].direction;
      let currentPoints: STPoint[] = [{ time: stData[0].time, value: stData[0].value }];

      for (let i = 1; i < stData.length; i++) {
        const pt = stData[i];
        if (pt.direction === currentDir) {
          currentPoints.push({ time: pt.time, value: pt.value });
        } else {
          // Bridge: add the transition point to close the current segment visually
          currentPoints.push({ time: pt.time, value: pt.value });
          segments.push({ direction: currentDir, points: currentPoints });
          // Start new segment at the same bridging point
          currentDir    = pt.direction;
          currentPoints = [{ time: pt.time, value: pt.value }];
        }
      }
      segments.push({ direction: currentDir, points: currentPoints });

      const stSeriesArr: ISeriesApi<"Line">[] = [];
      for (const seg of segments) {
        const color = seg.direction === "up" ? "#10B981" : "#EF4444";
        const s = chart.addSeries(LineSeries, {
          color,
          lineWidth:        2,
          lineStyle:        0,
          lastValueVisible: false,
          priceLineVisible: false,
        });
        s.setData(seg.points as Parameters<typeof s.setData>[0]);
        stSeriesArr.push(s);
      }
      indicatorSeriesRefs.current.stSegments = stSeriesArr;
    }

    // Fit content after data load
    chart.timeScale().fitContent();
  }, [data, showMaLines, indicators]);

  // ── Toggle a named indicator ──────────────────────────────────────────────
  function toggleIndicator(name: string) {
    setIndicators(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
  function selectTimeframe(tf: typeof TIMEFRAME_PRESETS[number]) {
    setTfState({ interval: tf.interval, lookback: tf.lookback });
    setSelectedTF(tf.label);
  }

  function toggleChartType() {
    setChartType(prev => prev === "candle" ? "heikin_ashi" : "candle");
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {title && (
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
        )}
        <div className="flex items-center gap-1 ml-auto flex-wrap">
          {/* Timeframe buttons */}
          {TIMEFRAME_PRESETS.map(tf => (
            <button
              key={tf.label}
              onClick={() => selectTimeframe(tf)}
              className={cn(
                "h-6 px-2 rounded text-xs font-medium transition-colors",
                selectedTF === tf.label
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {tf.label}
            </button>
          ))}

          {/* Divider */}
          <div className="w-px h-4 bg-border mx-1" />

          {/* MA toggle */}
          <button
            onClick={() => setShowMaLines(v => !v)}
            className={cn(
              "h-6 px-2 rounded text-xs font-medium transition-colors",
              showMaLines
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            MA
          </button>

          {/* Divider */}
          <div className="w-px h-4 bg-border mx-1" />

          {/* Heikin Ashi toggle */}
          <button
            onClick={toggleChartType}
            title="Heikin Ashi"
            className={cn(
              "h-6 px-2 rounded text-xs font-medium transition-colors",
              chartType === "heikin_ashi"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            HA
          </button>

          {/* Bollinger Bands toggle */}
          <button
            onClick={() => toggleIndicator("bb")}
            title="Bollinger Bands"
            className={cn(
              "h-6 px-2 rounded text-xs font-medium transition-colors",
              indicators.has("bb")
                ? "bg-blue-500 text-white"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            BB
          </button>

          {/* VWAP toggle */}
          <button
            onClick={() => toggleIndicator("vwap")}
            title="VWAP"
            className={cn(
              "h-6 px-2 rounded text-xs font-medium transition-colors",
              indicators.has("vwap")
                ? "bg-purple-500 text-white"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            VWAP
          </button>

          {/* SuperTrend toggle */}
          <button
            onClick={() => toggleIndicator("supertrend")}
            title="SuperTrend"
            className={cn(
              "h-6 px-2 rounded text-xs font-medium transition-colors",
              indicators.has("supertrend")
                ? "bg-emerald-500 text-white"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            ST
          </button>
        </div>
      </div>

      {/* Chart container */}
      <div className="relative rounded-md border overflow-hidden bg-background">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading chart…
            </div>
          </div>
        )}
        {isError && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-center text-muted-foreground text-sm">
              <p>Chart data unavailable</p>
              <p className="text-xs mt-1">{(error as Error)?.message}</p>
            </div>
          </div>
        )}
        <div
          ref={chartContainerRef}
          style={{ height: `${height}px`, width: "100%" }}
        />
      </div>
    </div>
  );
}

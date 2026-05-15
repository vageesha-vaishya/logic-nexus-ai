/**
 * <Sparkline> — fixed-size inline trendline. ADR-026 §2.
 *
 * Canvas-based (not SVG) so it scales fine to thousands of row-level
 * sparklines on a watchlist or holdings table without DOM blow-up.
 *
 *   <Sparkline series={[124, 130, 128, 135, 142]} />
 *
 * Direction is inferred from series[0] → series[last]; pass `direction` to
 * override. No axes, no labels — that is intentional; sparklines are
 * "what does the trend feel like", not measurement.
 */

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { directionOf, type Direction } from "@/lib/format";

interface SparklineProps {
  series: number[];
  /** Width in CSS pixels (canvas internal scales by devicePixelRatio). Default 80. */
  width?: number;
  /** Height in CSS pixels. Default 24. */
  height?: number;
  /** Stroke width in CSS pixels. Default 1.5. */
  strokeWidth?: number;
  /** Fill area under the line with a soft variant of the color. Default true. */
  fillArea?: boolean;
  /** Override the inferred direction (and therefore color). */
  direction?: Direction;
  /** Accessibility label (e.g. "Last 30 days, up 4.2%"). */
  accessibleLabel?: string;
  className?: string;
}

export function Sparkline({
  series,
  width = 80,
  height = 24,
  strokeWidth = 1.5,
  fillArea = true,
  direction,
  accessibleLabel,
  className,
}: SparklineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawSparkline(canvas, series, {
      width,
      height,
      strokeWidth,
      fillArea,
      direction:
        direction ??
        (series.length >= 2
          ? directionOf(series[series.length - 1] - series[0])
          : "flat"),
    });
  }, [series, width, height, strokeWidth, fillArea, direction]);

  const isEmpty = !series || series.length < 2;

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width, height, display: "inline-block", verticalAlign: "middle" }}
      role="img"
      aria-label={accessibleLabel ?? (isEmpty ? "No data" : "Trend chart")}
      className={cn(isEmpty && "opacity-30", className)}
    />
  );
}

/** Read the resolved HSL color of a CSS custom-property at runtime. */
function resolveHslVar(name: string, alpha: number = 1): string {
  if (typeof window === "undefined") return "currentColor";
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  if (!value) return "currentColor";
  return `hsl(${value} / ${alpha})`;
}

interface DrawOpts {
  width: number;
  height: number;
  strokeWidth: number;
  fillArea: boolean;
  direction: Direction;
}

function drawSparkline(canvas: HTMLCanvasElement, series: number[], opts: DrawOpts) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  canvas.width = opts.width * dpr;
  canvas.height = opts.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, opts.width, opts.height);

  if (!series || series.length < 2) return;

  // Resolve theme-aware colors at draw-time so dark-mode flips work.
  const colorVar =
    opts.direction === "up"
      ? "--up"
      : opts.direction === "down"
      ? "--down"
      : "--neutral";
  const stroke = resolveHslVar(colorVar, 1);
  const fill = resolveHslVar(colorVar, 0.18);

  // Compute pixel-space path with a 1.5px inset on top/bottom so the stroke isn't clipped.
  const pad = opts.strokeWidth / 2 + 1;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const stepX = (opts.width - pad * 2) / (series.length - 1);

  const points: Array<[number, number]> = series.map((v, i) => {
    const x = pad + i * stepX;
    const yNorm = (v - min) / range;
    const y = opts.height - pad - yNorm * (opts.height - pad * 2);
    return [x, y];
  });

  // Optional area fill
  if (opts.fillArea) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], opts.height - pad);
    for (const [x, y] of points) ctx.lineTo(x, y);
    ctx.lineTo(points[points.length - 1][0], opts.height - pad);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  // Stroke
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = opts.strokeWidth;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
}

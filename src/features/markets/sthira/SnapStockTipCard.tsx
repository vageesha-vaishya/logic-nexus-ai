// SnapStockTipCard — Sthira Home tab card. Lets the user upload a
// screenshot of a stock tip and surfaces a fit-against-your-profile
// reading. Mobile-first.

import { useRef, useState } from "react";
import { Camera, Sparkles, Loader2, AlertCircle, CheckCircle2, AlertTriangle, ImageOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useRiskProfile } from "@/features/markets/retail/hooks/useRiskProfile";
import { useExtractStockTip, type StockTipOutput, type FitVerdict } from "./useExtractStockTip";

const VERDICT_STYLE: Record<FitVerdict, { label: string; icon: typeof CheckCircle2; className: string }> = {
  fits:        { label: "Fits your profile",      icon: CheckCircle2, className: "border-emerald-300 text-emerald-700" },
  stretch:     { label: "Stretch",                icon: AlertTriangle, className: "border-amber-300 text-amber-700" },
  off_profile: { label: "Off-profile — skip",     icon: AlertCircle, className: "border-red-300 text-red-700" },
  unreadable:  { label: "Couldn't read it",       icon: ImageOff, className: "border-muted-foreground/30 text-muted-foreground" },
};

export function SnapStockTipCard() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const riskProfile = useRiskProfile();
  const extract = useExtractStockTip();
  const [result, setResult] = useState<StockTipOutput | null>(null);

  const ready = riskProfile.hasOnboarded && !!riskProfile.data;

  const onPick = async (file: File | null) => {
    if (!file || !riskProfile.data) return;
    setResult(null);
    try {
      const goalsSummary = (riskProfile.data.goals ?? [])
        .map((g) => (typeof g === "string" ? g : (g as { name?: string }).name ?? ""))
        .filter(Boolean)
        .slice(0, 4)
        .join("; ")
        .slice(0, 400);
      const res = await extract.mutateAsync({
        experience_level: riskProfile.data.experience_level,
        risk_tag: riskProfile.data.risk_tag,
        goals_summary: goalsSummary || undefined,
        screenshot: file,
      });
      if (res.parsed_output) setResult(res.parsed_output);
    } catch {
      /* hook surfaces toast */
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  if (!ready) {
    // Quiet — keep the home tab minimal for users who haven't onboarded yet.
    return null;
  }

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            Got a stock tip?
          </div>
          <p className="text-xs text-muted-foreground">
            Snap a screenshot — WhatsApp, news, or chart — and I'll tell you if it fits your goals.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={extract.isPending}
        >
          {extract.isPending ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Camera className="mr-1 h-4 w-4" />
          )}
          Snap it
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => { void onPick(e.target.files?.[0] ?? null); }}
        />
      </div>

      {result && (
        <div className="mt-3 space-y-2 border-t pt-3">
          {(() => {
            const v = VERDICT_STYLE[result.fit_verdict];
            const Icon = v.icon;
            return (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn("gap-1", v.className)}>
                  <Icon className="h-3 w-3" />
                  {v.label}
                </Badge>
                {result.tickers.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {result.tickers.slice(0, 4).map((t) => (
                      <Badge key={t} variant="secondary" className="font-mono text-[10px]">{t}</Badge>
                    ))}
                  </div>
                )}
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {(result.confidence * 100).toFixed(0)}% confidence
                </span>
              </div>
            );
          })()}
          <p className="text-sm text-foreground/90">{result.claim}</p>
          <p className="text-xs text-muted-foreground">{result.explanation}</p>
          <div className="rounded-md bg-muted/40 px-2 py-1.5 text-xs">
            <span className="font-semibold">Suggested next step:</span> {result.suggested_action}
          </div>
        </div>
      )}
    </section>
  );
}

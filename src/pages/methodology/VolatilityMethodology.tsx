import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { RiskPill } from "@/components/risk-pill";
import { SebiDisclaimer } from "@/components/sebi-disclaimer";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Public methodology page that explains how the RiskPill (Low / Medium / High)
 * is computed. Surfaced from every RiskPill via its `methodologyHref` prop
 * (default `/methodology/volatility`).
 *
 * Why this page exists: SEBI compliance. Every advisory number must be paired
 * with a reviewable methodology page so the math is auditable and the
 * defaults can be challenged. Smallcase publishes its volatility page at
 * smallcase.com/meta/volatility-calculation — this is our equivalent.
 *
 * Tone is intentionally Groww/Smallcase plain-language, NOT legalese. The
 * formal disclaimer sits in <SebiDisclaimer> at the bottom.
 */
export default function VolatilityMethodology(): JSX.Element {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-10 md:py-14">
        <Link
          to="/"
          className="
            inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground
            focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded
          "
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </Link>

        <header className="mt-6 mb-10 space-y-3">
          <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
            Methodology · Risk pill
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            How we calculate the risk level
          </h1>
          <p className="text-base text-muted-foreground">
            Whenever you see one of these on a fund, basket, or stock, this is
            the math behind it. We want you to be able to challenge our default
            — not take it on faith.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <RiskPill risk="low" showMethodologyLink={false} />
            <RiskPill risk="medium" showMethodologyLink={false} />
            <RiskPill risk="high" showMethodologyLink={false} />
          </div>
        </header>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">The number we compute</h2>
          <p className="text-sm leading-relaxed">
            We compute <span className="font-medium">annualised volatility</span> —
            in plain English, how much an investment's price tends to swing
            over a year. Higher number means bigger swings up and down, which
            usually means more stress to hold and a bigger range of possible
            outcomes.
          </p>

          <Card>
            <CardContent className="space-y-3 p-5 text-sm">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Formula
              </p>
              <ol className="ml-5 list-decimal space-y-1.5">
                <li>Take the daily NAV (price) series over the last 12 months.</li>
                <li>Compute the daily return between each consecutive day.</li>
                <li>Take the standard deviation of those daily returns.</li>
                <li>
                  Multiply by <span className="font-mono">√252</span> — the
                  approximate number of trading days in a year — to annualise.
                </li>
                <li>Multiply by 100 to express as a percentage.</li>
              </ol>
              <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">
{`volatility_annualised = stddev(daily_returns) × √252 × 100`}
              </pre>
              <p className="text-xs text-muted-foreground">
                Implemented in <span className="font-mono">computeVolatility</span> at
                {" "}<span className="font-mono">src/features/markets/components/PortfolioAnalyticsPanel.tsx</span>.
                Returns null when fewer than 30 daily NAV points are available
                (statistically unreliable), in which case the pill is hidden.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-semibold">The three buckets</h2>
          <p className="text-sm leading-relaxed">
            Three buckets, because a layman can read a traffic light but not a
            standard deviation. The thresholds below are absolute — they don't
            move with the market. If a fund's volatility crosses a boundary,
            the pill changes.
          </p>

          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Pill</th>
                  <th className="px-4 py-2 font-medium">Annualised volatility</th>
                  <th className="px-4 py-2 font-medium">Typical examples</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="px-4 py-3">
                    <RiskPill risk="low" showMethodologyLink={false} />
                  </td>
                  <td className="px-4 py-3 font-mono">&lt; 10%</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    Liquid funds, overnight funds, ultra-short debt, money-market funds
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3">
                    <RiskPill risk="medium" showMethodologyLink={false} />
                  </td>
                  <td className="px-4 py-3 font-mono">10% – 20%</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    Large-cap equity funds, balanced advantage, multi-asset hybrid, gold
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3">
                    <RiskPill risk="high" showMethodologyLink={false} />
                  </td>
                  <td className="px-4 py-3 font-mono">&gt; 20%</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    Small-cap & mid-cap equity, sectoral / thematic funds, single stocks
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            For reference: Nifty 50 has historically run around 15–18%
            annualised volatility; Indian small-cap indices have run closer to
            22–28%; liquid funds sit under 1%.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-semibold">Why those thresholds</h2>
          <p className="text-sm leading-relaxed">
            The 10% and 20% boundaries are chosen so that the boundary itself
            matches a real change in how the investment behaves — not just a
            number on a chart.
          </p>
          <ul className="ml-5 list-disc space-y-1.5 text-sm">
            <li>
              <span className="font-medium">Below 10%</span> — even a bad year
              rarely produces a drawdown deeper than your risk appetite for a
              "safe" allocation. Loss is possible but unlikely to feel
              dramatic.
            </li>
            <li>
              <span className="font-medium">10% – 20%</span> — the working
              range of broad equity exposure in India. Expect calendar years
              where you lose 10–15%; expect others where you gain 20–25%.
            </li>
            <li>
              <span className="font-medium">Above 20%</span> — drawdowns of
              30%+ during stressed markets become normal, not exceptional.
              Holding through them is the hard part.
            </li>
          </ul>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-semibold">Benchmarks by asset class</h2>
          <p className="text-sm leading-relaxed">
            The pill is an absolute reading, but if you want to compare a fund
            to a market reference, this is what we anchor against:
          </p>
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Asset class</th>
                  <th className="px-4 py-2 font-medium">Reference index</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="px-4 py-3">Large-cap equity</td>
                  <td className="px-4 py-3 font-mono">Nifty 100 TRI</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Mid-cap equity</td>
                  <td className="px-4 py-3 font-mono">Nifty Midcap 150 TRI</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Small-cap equity</td>
                  <td className="px-4 py-3 font-mono">Nifty Smallcap 250 TRI</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Debt / fixed-income</td>
                  <td className="px-4 py-3 font-mono">CRISIL Composite Bond Fund Index</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Gold</td>
                  <td className="px-4 py-3 font-mono">Domestic gold price (₹/g)</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Multi-asset</td>
                  <td className="px-4 py-3 font-mono">60/40 blend (Nifty 100 + CRISIL Bond)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            The pill itself is computed against the investment's own NAV
            series, not the benchmark. Benchmarks above are used only when we
            need a contextual comparison ("12% vol vs. Nifty 100's 16%").
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-semibold">What this doesn't capture</h2>
          <ul className="ml-5 list-disc space-y-1.5 text-sm">
            <li>
              <span className="font-medium">Tail risk.</span> Annualised
              volatility assumes returns are roughly normally distributed.
              They aren't — markets have fat tails. A "medium" investment can
              still lose 30% in a black-swan month.
            </li>
            <li>
              <span className="font-medium">Forward-looking risk.</span> This
              is computed from the last 12 months of history. It does not
              predict the next 12 months. Past performance is not indicative
              of future results.
            </li>
            <li>
              <span className="font-medium">Liquidity risk.</span> An
              investment can have low day-to-day volatility but be hard to
              exit at the price you see (some debt funds, small-cap stocks
              during stress). The pill does not score this.
            </li>
            <li>
              <span className="font-medium">Credit risk.</span> For debt
              funds, the pill scores price volatility, not the credit quality
              of the underlying issuers.
            </li>
          </ul>
        </section>

        <section className="mt-10">
          <SebiDisclaimer />
        </section>

        <footer className="mt-10 border-t pt-4 text-xs text-muted-foreground">
          <p>
            Last reviewed: 2026-05-25. Material changes to this methodology
            require sign-off from the compliance officer per SEBI's investment
            advisory framework.
          </p>
        </footer>
      </div>
    </main>
  );
}

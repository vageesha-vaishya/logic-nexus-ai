/**
 * SETUP_CARDS — the full v1 task registry for the "Get set up" panel.
 *
 * Five cards per self-serve domain (logistics + markets) per the design
 * doc table §"Setup cards + invite flow". Order field controls position
 * in the panel; "always" cards appear from day one, "on_action" cards
 * stay hidden until a feature gate promotes them (U-C3, Stripe pattern).
 *
 * Add a task here, ship — no DB migration required. Existing tenants
 * see new "always" cards on next load (missing row in
 * tenant_setup_progress is treated as status='pending').
 *
 * CTA destinations that don't have a built page yet (`import_shipments`,
 * `sebi_sub_broker_reg`, the two `take_tour` placeholders) intentionally
 * omit `ctaTo` so the card shows a single "Mark done" button instead of
 * routing to a 404. We'll fill those in as the matching features land.
 *
 * See docs/plans/2026-05-22-unified-platform-onboarding-design.md.
 */
import {
  Compass,
  Inbox,
  Link2,
  Receipt,
  ShieldCheck,
  Truck,
  UserPlus,
} from "lucide-react";
import type { SetupCardDefinition } from "./types";

export const SETUP_CARDS: readonly SetupCardDefinition[] = [
  // ─── LOGISTICS ────────────────────────────────────────────────────────────
  {
    key:      "invite_team",
    domain:   "logistics",
    title:    "Invite your team",
    body:     "Add teammates so they can capture leads, run quotations, and own opportunities alongside you.",
    ctaLabel: "Invite teammate",
    ctaTo:    "/dashboard/settings/team",
    icon:     UserPlus,
    trigger:  "always",
    order:    10,
  },
  {
    key:      "connect_lead_channels",
    domain:   "logistics",
    title:    "Connect your lead channels",
    body:     "Plug in WhatsApp Business, email aliases, Telegram, and webhooks — every inbound message lands in your inbox as a lead.",
    ctaLabel: "Connect channels",
    ctaTo:    "/dashboard/settings/channel-integrations",
    icon:     Inbox,
    trigger:  "always",
    order:    20,
    unlocks:  "Inbound lead capture across email + WhatsApp",
  },
  {
    key:      "import_shipments",
    domain:   "logistics",
    title:    "Import your shipment history",
    body:     "Upload a CSV of past shipments (or paste from Excel) so dashboards have something to chart from day one.",
    ctaLabel: "Mark done",
    icon:     Truck,
    trigger:  "always",
    order:    30,
    unlocks:  "Analytics + carrier-scoring backfill",
  },
  {
    key:      "take_tour",
    domain:   "logistics",
    title:    "Take a one-minute product tour",
    body:     "Quick walk-through of pipelines, quotations, and invoices so you know where everything lives.",
    ctaLabel: "Mark done",
    icon:     Compass,
    trigger:  "always",
    order:    40,
  },
  {
    key:      "add_gst",
    domain:   "logistics",
    title:    "Add your GSTIN",
    body:     "We need your GST number to issue tax-compliant invoices. Add it once and every invoice from then on includes the right HSN + GST breakup.",
    ctaLabel: "Add GSTIN",
    ctaTo:    "/dashboard/settings/billing",
    icon:     Receipt,
    trigger:  "on_action",
    order:    50,
    unlocks:  "Tax invoices + GST returns",
  },

  // ─── MARKETS-ADVISOR ──────────────────────────────────────────────────────
  {
    key:      "invite_advisors",
    domain:   "markets",
    title:    "Invite your advisors",
    body:     "Each advisor gets their own portfolios, risk score, and signal feed. You can promote them to franchise admins later.",
    ctaLabel: "Invite advisor",
    ctaTo:    "/dashboard/settings/team",
    icon:     UserPlus,
    trigger:  "always",
    order:    10,
  },
  {
    key:      "connect_broker",
    domain:   "markets",
    title:    "Connect a broker",
    body:     "OAuth your Zerodha or Fyers account so real positions sync into the platform. Until then everything runs in paper mode.",
    ctaLabel: "Connect broker",
    ctaTo:    "/dashboard/markets/settings/brokers",
    icon:     Link2,
    trigger:  "always",
    order:    20,
    unlocks:  "Real-money trading + live P&L",
  },
  {
    key:      "take_tour",
    domain:   "markets",
    title:    "Take a one-minute advisor tour",
    body:     "Quick walk-through of portfolios, risk score, signals, and the rebalancing flow.",
    ctaLabel: "Mark done",
    icon:     Compass,
    trigger:  "always",
    order:    30,
  },
  {
    key:      "add_pan_business",
    domain:   "markets",
    title:    "Add business PAN",
    body:     "We need your business PAN + address to generate tax-compliant invoices for paid plans. Add it before your trial ends.",
    ctaLabel: "Add PAN",
    ctaTo:    "/dashboard/settings/billing",
    icon:     Receipt,
    trigger:  "on_action",
    order:    40,
    unlocks:  "Tax invoices for paid plans",
  },
  {
    key:      "sebi_sub_broker_reg",
    domain:   "markets",
    title:    "Register your SEBI sub-broker / RIA details",
    body:     "Going live with real-money signals for clients needs your SEBI registration on file. Paper mode and personal portfolios don't require this.",
    ctaLabel: "Mark done",
    icon:     ShieldCheck,
    trigger:  "on_action",
    order:    50,
    unlocks:  "Live-money signals for client portfolios",
  },
];

export function setupCardsForDomain(domain: SetupCardDefinition["domain"]): SetupCardDefinition[] {
  return SETUP_CARDS.filter((c) => c.domain === domain);
}

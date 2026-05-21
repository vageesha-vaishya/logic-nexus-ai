/**
 * Sthira brand voice — central tuning point.
 *
 * Calm Wealth voice: advisory, second-person, no exclamation marks,
 * sage/terracotta replace green/red. Keep strings here so a copywriter
 * can iterate without grepping the codebase.
 *
 * See docs/plans/2026-05-20-sthira-mobile-onboarding-and-markets-ux-design.md §"Voice"
 */

export const STHIRA_COPY = {
  greeting: (name?: string | null) =>
    name ? `Hello, ${name.split(" ")[0]}` : "Welcome to Sthira",

  portfolio: {
    summary:        "Your wealth at",
    todayLabel:     "today",
    onTrackFor:     (year: number) => `on track for ${year}`,
    progressLabel:  (pct: number, target: string) => `${pct}% of ${target}`,
    noPortfolios:   "Set a goal to see progress",
    noPortfoliosCta: "Add a goal",
  },

  tiers: {
    safetyNet:    { name: "Safety Net",      tagline: "Capital protected · Emergency access" },
    core:         { name: "Core Portfolio",  tagline: "Long-term wealth · High-conviction signals" },
    experimental: { name: "Experimental",    tagline: "Active signals · Separate P&L" },
  },

  signals: {
    sectionTitle:   "Latest signals",
    seeAll:         "See all",
    none:           "No signals yet — they appear as the market moves",
    confidenceFmt:  (pct: number) => `${pct}%`,
  },

  brokers: {
    sectionTitle:   "Brokers",
    connectedCount: (n: number) => (n === 1 ? "1 connected" : `${n} connected`),
    addCta:         "Add a broker to see real holdings",
    syncedAgo:      (relative: string) => `synced ${relative}`,
    syncNow:        "Sync",
    paperMode:      "Paper mode",
  },

  risk: {
    badge: (tag: string) => tag.replace(/^./, (c) => c.toUpperCase()),
  },

  errors: {
    riskScoreCouldNotLoad: "Couldn't load risk score",
    retry:                 "Try again",
    offlineHint:           "Showing your last saved view — reconnect to refresh.",
  },
} as const;

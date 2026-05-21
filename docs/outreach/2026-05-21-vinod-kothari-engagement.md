# Vinod Kothari Consultants — engagement outreach

**Status:** draft for user review · not sent
**Date drafted:** 2026-05-21
**Author:** Vimal Bahuguna (SOS Fintech)
**Companion drafts:** `2026-05-21-finsec-engagement.md`, `2026-05-21-argus-engagement.md`
**Plan reference:** `docs/plans/2026-05-18-retail-investment-platform-phase1-addendum.md` §Q3 + Appendix C
**Memory:** `project_phase1_remaining_tasks.md` — T19 + T20 LLM-summary layer gated on this review

Parallel-discovery email — same body as the Finsec and Argus drafts, only the opening paragraph is personalized. Send all three in the same hour so responses come back on a comparable timeline.

---

## Email

**To:** info@vinodkothari.com *(verify on the firm's contact page before sending)*
**Subject:** SEBI compliance engagement — AI-assisted retail investment platform, Q1 2027 launch

Dear Vinod Kothari Consultants team,

I came to you specifically through your published analysis **"Research Analysts v/s Investment Advisors – Is the Line Blurring?"** — that paper engaged directly with the regulatory boundary an AI-assisted recommendation platform like ours has to live on. Your multi-office reach across financial-services regulatory work is exactly the depth we need.

I am reaching out on behalf of **SOS Fintech**. We are building a retail investment platform targeting Indian retail investors, with a planned **Q1 2027 launch ahead of the April 1 2027 SEBI deadline**. I would like to schedule a 30-minute discovery call this week or next to walk you through the platform and explore an engagement.

**Disclosure:** I am running parallel discovery conversations with two other firms on the same shortlist. Happy to share that the engagement scope and timeline I am presenting to you is identical, so any proposal you put forward will be compared on substance, not framing.

### Platform in one paragraph

Goal-anchored, three-tier portfolio framework (Foundation / Growth / Opportunistic). A proprietary signal engine generates trade ideas; an LLM **interprets** those signals into plain-language explanations — it never originates buy/sell recommendations. Layered on top: a daily AI-generated portfolio health diagnostic, holdings-aware market commentary, and drift-based portfolio rebalancing that is biometrically confirmed by the user trade-by-trade. KYC is broker-passthrough via Zerodha (Kite Connect) and Fyers OAuth at launch; the platform never custodies user funds — execution always runs through the user's existing broker.

### What we would like the engagement to scope

1. **RA / IA registration assessment.** Given the Dec 16 2024 amendments and Jan 8 2025 circulars on the tiered deposit system and the entity-form requirement (LLP / body corporate by **Sep 30 2025** if no qualified individual partner — a deadline that has now elapsed, which itself needs your read), advise whether SOS Fintech should register as a Research Analyst or Investment Adviser, and what registration class fits the interpretation-only LLM model above. Your "Line Blurring" analysis suggests you already have a developed view on the LLM-interpretation-vs-recommendation distinction; that view is exactly what we need to test our design against.
2. **LLM prompt + 500-sample output review.** Review of ~8–10 production prompts plus a 500-sample dump of LLM outputs, with written sign-off that they fall on the interpretation side of the RA boundary rather than the recommendation side. This is the gate that unblocks production deploy of two of our planned surfaces (portfolio health diagnostic; AI-summarized market commentary).
3. **Autonomous-execution audit-trail review.** Sign-off that our per-trade biometric consent flow, with the full recommendation payload logged at the moment of confirmation, constitutes user-initiated execution rather than discretionary management.
4. **Launch and advertising compliance.** Review of marketing collateral, finfluencer-adjacent risks, and required disclaimers.

### Timeline we are working toward

- **Engagement signed:** end of May 2026
- **Item 2 (prompt + output review) complete:** end of August 2026 — unblocks the AI-summary production deploy
- **Item 3 (autonomous-execution audit-trail review) complete:** end of October 2026 — unblocks the rebalancing flow
- **Item 4 (launch compliance) complete:** end of January 2027 — ahead of the April 1 2027 deadline

Happy to NDA before sharing internal architecture, sample prompts, or the audit-trail schema. I can be available for the discovery call at [insert your availability — e.g. weekdays 2–6 PM IST through next Friday].

Best regards,

Vimal Bahuguna
SOS Fintech
[phone]
[bahuguna.vimal@gmail.com]

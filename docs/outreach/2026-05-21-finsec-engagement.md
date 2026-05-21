# Finsec Law Advisors — engagement outreach

**Status:** draft for user review · not sent
**Date drafted:** 2026-05-21
**Author:** Vimal Bahuguna (SOS Fintech)
**Plan reference:** `docs/plans/2026-05-18-retail-investment-platform-phase1-addendum.md` §Q3 + Appendix C
**Memory:** `project_phase1_remaining_tasks.md` — T19 + T20 LLM-summary layer gated on this review

Personalized to Finsec specifically (the addendum shortlisted three firms; user picked Finsec on 2026-05-21). Tone is discovery-call ask, not RFP — keep the firm leaning in, not bidding.

---

## Email

**To:** info@finseclaw.com *(verify on the firm's contact page before sending)*
**Subject:** SEBI compliance engagement — AI-assisted retail investment platform, Q1 2027 launch

Dear Finsec team,

I came to you specifically through your published tracker on the January 2025 SEBI Research Analyst / Investment Adviser guideline overhaul — that work was directly relevant to a question we are wrestling with at **SOS Fintech**, and your SEBI-only practice is exactly the depth we need.

We are building a retail investment platform targeting Indian retail investors, with a planned **Q1 2027 launch ahead of the April 1 2027 SEBI deadline**. I would like to schedule a 30-minute discovery call this week or next to walk you through the platform and explore an engagement.

**Disclosure:** I am running parallel discovery conversations with two other firms on the same shortlist. The engagement scope and timeline below is identical across all three, so any proposal you put forward will be compared on substance, not framing.

### Platform in one paragraph

Goal-anchored, three-tier portfolio framework (Foundation / Growth / Opportunistic). A proprietary signal engine generates trade ideas; an LLM **interprets** those signals into plain-language explanations — it never originates buy/sell recommendations. Layered on top: a daily AI-generated portfolio health diagnostic, holdings-aware market commentary, and drift-based portfolio rebalancing that is biometrically confirmed by the user trade-by-trade. KYC is broker-passthrough via Zerodha (Kite Connect) and Fyers OAuth at launch; the platform never custodies user funds — execution always runs through the user's existing broker.

### What we would like Finsec to scope

1. **RA / IA registration assessment.** Given the Dec 16 2024 amendments and Jan 8 2025 circulars on the tiered deposit system and the entity-form requirement (LLP / body corporate by **Sep 30 2025** if no qualified individual partner — a deadline that has now elapsed, which itself needs your read), advise whether SOS Fintech should register as a Research Analyst or Investment Adviser, and what registration class fits the interpretation-only LLM model above.
2. **LLM prompt + 500-sample output review.** Review of ~8–10 production prompts plus a 500-sample dump of LLM outputs, with written sign-off that they fall on the interpretation side of the RA boundary rather than the recommendation side. This is the gate that unblocks production deploy of two of our planned surfaces (portfolio health diagnostic; AI-summarized market commentary).
3. **Autonomous-execution audit-trail review.** Sign-off that our per-trade biometric consent flow, with the full recommendation payload logged at the moment of confirmation, constitutes user-initiated execution rather than discretionary management.
4. **Launch and advertising compliance.** Review of marketing collateral, finfluencer-adjacent risks, and required disclaimers.

### Timeline we are working toward

- **Engagement signed:** end of May 2026
- **Item 2 (prompt + output review) complete:** end of August 2026 — unblocks the AI-summary production deploy
- **Item 3 (autonomous-execution audit-trail review) complete:** end of October 2026 — unblocks the rebalancing flow
- **Item 4 (launch compliance) complete:** end of January 2027 — ahead of the April 1 2027 deadline

I have attached a one-page platform brief that should answer most of the architectural questions you would otherwise ask in the first ten minutes of the call. Happy to NDA before sharing sample prompts, the 500-sample LLM output dump, or the audit-trail schema. I can be available for the discovery call at [insert your availability — e.g. weekdays 2–6 PM IST through next Friday].

Best regards,

Vimal Bahuguna
SOS Fintech
[phone]
[bahuguna.vimal@gmail.com]

---

## What to do before sending

- [ ] Verify the firm's actual contact email on finseclaw.com (the `info@…` guess above may not be correct; LinkedIn often shows a specific partner address for fintech inquiries).
- [ ] Replace `[insert your availability]` with two or three real time blocks.
- [ ] Fill in phone and confirm the bahuguna.vimal@gmail.com sender address is the one you want on the legal-firm-facing channel — many founders use a `name@<company-domain>` address for this kind of outreach.
- [ ] Send all three drafts (Finsec, Vinod Kothari, Argus) in the same hour so responses come back on comparable timelines. The parallel-discovery disclosure paragraph is already in each draft — keep it.
- [ ] Convert `docs/outreach/2026-05-21-platform-one-pager.md` to PDF (`pandoc` or any markdown-to-PDF tool) and attach to each outbound email. Designed to fit one printed A4 page.

## What NOT to do

- Do not commit to a fee or retainer in this email — the ask is a 30-minute discovery call, full stop.
- Do not share sample LLM outputs, prompts, or audit-trail schemas before the NDA is in place. Finsec will likely send their standard NDA; review it (or have it reviewed) before signing.
- Do not promise the platform will not give buy/sell advice — that is the question Finsec is being engaged to answer. Describe the design intent, not a regulatory conclusion.

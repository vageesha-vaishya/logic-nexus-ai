# Self-onboarding wizard — manual E2E checklist

Audience: solo operator. Run before handing the next closed-beta build to a
friend. Estimated time: 25–30 min on Android + 10 min on desktop browser.

Companion: `docs/plans/2026-05-21-self-onboarding-wizard-design.md`,
`docs/Runbooks/2026-05-22-supabase-auth-hook-config.md`.

## Prereqs

1. Supabase Auth → Database Webhook for `auth.users INSERT` is **enabled**
   and pointing at `provision-retail-user` (verified via the runbook).
2. Latest APK is installed on the test Android device (`npm run mobile:build:markets`
   on the laptop, then `adb install -r` or Firebase App Distribution).
3. Desktop browser session: Chrome on the laptop, logged out.
4. A fresh `@yopmail.com` email you haven't used before (e.g.
   `sthira-e2e-2026-05-22@yopmail.com`).

## Track A — Android (Sthira shell)

### A1. Signup → wizard mount

- [ ] Open the Sthira APK. Splash shows the navy "Sthira / Steady Wealth" card.
- [ ] Splash redirects to `/auth/login` (no session).
- [ ] Sign up with a fresh email. Email-verification flow completes.
- [ ] Open the verification email in another tab on the desktop, click the
      link. Android app should auto-resume into the splash and then route to
      `/sthira/onboarding`.
- [ ] If the wizard arrives *before* the post-signup Auth hook has finished:
      a "Setting up your account…" spinner shows for ≤1s and then step 2
      mounts. (The provision fallback in `useOnboardingProvision` should fire
      transparently.)

### A2. Step 2 — Welcome + disclosure

- [ ] First-name greeting shows ("Welcome, Vimal" if `profile.first_name`
      is set, otherwise the email local-part).
- [ ] The four acknowledgement checkboxes are unchecked.
- [ ] "I agree — continue" is disabled until **all four** are ticked.
- [ ] The disclosure link opens `/legal/retail-disclosure` in a new tab.
- [ ] Tap continue → step 3 appears, progress bar advances to 2/7.

### A3. Step 3 — Risk quiz (10 questions)

- [ ] All 10 questions render in order: horizon, drawdown, income,
      reaction, experience, dependents, objective, trauma, liquidity,
      sophistication.
- [ ] Tapping a row (anywhere, not just the radio dot) selects that option.
- [ ] Continue stays disabled until every question is answered.
- [ ] **Force quit the app mid-quiz**. Reopen → wizard resumes on step 3,
      previously-answered questions are preserved (localStorage draft).
- [ ] Answer all 10 → tap Continue. Step 4 appears.

### A4. Step 4 — Goals + priority

- [ ] Goal chips render along the top (Retirement / Emergency Fund /
      Wealth Growth / Education / Home Purchase / Short-term Income /
      Just exploring).
- [ ] Picking a goal adds a card below labelled "Primary".
- [ ] Pick a 2nd and 3rd goal — they get labelled "2nd" and "3rd".
- [ ] Try to pick a 4th — disabled with "Maximum 3 goals" note.
- [ ] Up/Down arrows reorder the cards correctly.
- [ ] Slider sets horizon (1–40 yrs); value updates in real time.
- [ ] ₹ target field accepts a number; empty / 0 / negative clears it.
- [ ] Remove (X) on a card; remaining cards renumber.
- [ ] Continue with 1+ goals selected.

### A5. Step 5 — Tier sliders

- [ ] Three sliders mount: Safety Net / Core Portfolio / Experimental.
- [ ] Default % matches risk_tag baseline ± goal adjustments.
- [ ] Moving any slider redistributes the delta across the other two
      proportionally; sum always shows 100%.
- [ ] ₹ readout next to each slider updates based on a ₹1,00,000 budget.
- [ ] Tap Continue. Step 6 appears.

### A6. Step 6 — Starter template

- [ ] Three cards: Conservative / Balanced / Growth.
- [ ] One has the "Recommended" badge (driven by tier mix from step 5).
- [ ] Tap a non-recommended card → it gets the active outline + check mark.
- [ ] Tap Continue.

### A7. Step 7 — Nominee (skippable)

- [ ] Form renders: full name, relationship chip row (Spouse / Parent /
      Child / Sibling / Other), PAN field, 100% share slider.
- [ ] Type an invalid PAN like "ABCDE12" → error appears once you stop typing.
- [ ] Fix it to "ABCDE1234F" → error clears.
- [ ] Tap "Skip for now" → step 8 appears (no name/PAN required).
- [ ] (Or fill in and continue.)

### A8. Step 8 — Summary + finish

- [ ] Recap rows render: Risk profile, Goals, Buckets, Starter template
      (if set), Nominee (Skipped or "Name (Relationship)"), Starting
      capital "₹1,00,000 paper cash · 30% NIFTY 50 ETF".
- [ ] Tap "Take me home" → toast "You're all set — welcome to Sthira."
- [ ] Navigates to `/dashboard/markets/retail/home`.

### A9. First-Home coach-marked tour

- [ ] Tour mounts on the first Home view.
- [ ] Step 1 highlights the dashboard summary at the top of Home with
      tooltip "Your portfolio at a glance".
- [ ] Step 2 highlights the Risk Score card.
- [ ] Step 3 highlights the News carousel.
- [ ] Step 4 highlights the Signals tab in the bottom nav.
- [ ] Step 5 highlights the More tab.
- [ ] "Skip" link on step 1 dismisses the entire tour.
- [ ] Esc / hardware-back also dismisses.
- [ ] After dismiss or Finish, killing + reopening the app does *not* re-show
      the tour. (`retail_profile.tour_completed = true`.)

### A10. Re-entry checks

- [ ] Sign out from More → Account → sign back in. Land on Home (not the
      wizard). Tour does not re-show.
- [ ] On a fresh second device with the same account, the wizard does
      *not* re-appear (DB-canonical resume).

### A11. Resumability

- [ ] Repeat A1 with a *second* fresh email. Get past step 3, then close
      the app.
- [ ] Reopen. Splash → /sthira/onboarding → wizard mounts at step 4
      (Goals) with progress 4/7, **not** at step 2.

## Track B — Desktop browser

Same wizard, friendlier URL. Use Chrome incognito so the localStorage
draft is isolated.

- [ ] Visit `https://gzhxgoigflftharcmdqj.supabase.co` host or whatever
      the desktop entry is, log out, sign up at `/auth` with a fresh email.
- [ ] After verification, visit `/onboarding`. The same wizard renders.
- [ ] Run through steps 2–8 identically to Track A. Layouts should look
      sane at 1280×800 (max-w-lg keeps the card centered).
- [ ] On finish, navigate to `/dashboard/markets/retail/home`. Tour mounts
      with spotlights on the desktop sidebar versions of the Signals + More
      tabs (the `findAnchor` visibility filter should pick the desktop
      variant, not the hidden mobile bottom nav).

## Failure modes — what to look for

| Symptom | Likely cause | Fix |
|---|---|---|
| Wizard stays on the loading spinner forever | Provision edge function 500 | Check `supabase functions logs provision-retail-user`; verify SOS-RETAIL franchise exists in `public.franchises` |
| Step 2 disclosure link 404s | `/legal/retail-disclosure` route not registered | Add a placeholder route in App.tsx |
| Quiz answers don't persist across app kill | localStorage write blocked (private mode? quota?) | Verify `sthira.onboarding.draft.<user_id>` key exists in DevTools → Application |
| Sliders accept values that don't sum to 100 | normalise() bug or drift > 1 | Re-run tier tests; check `redistribute()` |
| Tour fires every reload | `tour_completed` flag isn't being written | Check `retail_profile` row directly; verify upsert payload |
| Tour spotlight is in the wrong place | `findAnchor` picked the hidden duplicate of a nav tab | Confirm only one `[data-tour-id="tab-*"]` element has non-zero `getClientRects()` |
| Sthira splash sends user to `/sthira/broker` instead of Home | Stale `useSthiraOnboardingProgress` returning "broker" | Should now return "complete" — confirm hook is the updated version |

## When this checklist is done

Fold any friction-point fixes back into the task list, mark task #47
complete, and ship the next build.

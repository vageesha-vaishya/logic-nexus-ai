# Usability Feedback Apparatus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an in-app usability-feedback widget (flag-gated, off by default) backed by a new `ux_feedback` table, plus the protocol docs and export tooling needed to run and analyze real usability-testing rounds — Plan 3 of the design-system initiative.

**Architecture:** A Supabase migration adds `public.ux_feedback` (RLS: any authenticated user inserts their own row scoped to their own tenant; tenant admins/platform admin read) and seeds a disabled `platform.feature_flags` row. A React widget, gated by the existing `useAppFeatureFlag` system, collects `{task, completed, ease, comment}` plus auto-captured context (route/viewport/theme/UA) and inserts one row per submission. `docs/design-system/usability/export.mjs` turns rows for one round into the quantitative half of a findings write-up. Nothing here applies the migration to any real database — that is a separate, explicitly confirmed step (this repo's shared self-hosted Supabase is production-adjacent; see the spec).

**Tech Stack:** React 18 + TypeScript, Radix UI (`Popover`/`RadioGroup`/`Select`) via the existing shadcn wrappers, `@tanstack`-free direct Supabase client calls (matching `useCRM()`'s existing pattern), Postgres/PL-pgSQL migrations, `sonner` toasts, RTL + vitest, Node ESM for `export.mjs`.

## Global Constraints

- Table: `public.ux_feedback(id uuid pk, tenant_id uuid not null, user_id uuid not null references auth.users(id), round smallint not null, task_id text, route text not null, completed text check in ('yes','partial','no'), ease smallint check between 1 and 5, comment text, viewport_w int, viewport_h int, theme_mode text, user_agent text, created_at timestamptz not null default now())`. Indexes on `(tenant_id, round)` and `(round, task_id)`.
- RLS reuses the codebase's existing helpers verbatim — do not reinvent: `public.get_user_tenant_id(uuid)`, `public.is_platform_admin(uuid)`, `public.has_role(uuid, app_role)`, all `STABLE SECURITY DEFINER`, defined in `supabase/migrations/20251001011353_c6e4a402-3e6e-47c7-b19a-69d07c258f65.sql` and `20260128100001_fix_profiles_rls.sql`. `app_role` enum values: `'platform_admin','tenant_admin','franchise_admin','user'`.
- Feature flag key: `ux_feedback_widget`, added to the `FEATURE_FLAGS` const in `src/lib/feature-flags.ts` (the codebase's real, typed convention — not the raw `useFeatureFlags` hook). Default **false**. Backing table is `platform.feature_flags` (schema `platform`, NOT `public`); the FeatureFlagsPage admin UI at `/dashboard/settings/feature-flags` lists/toggles rows from it.
- **No database is touched by this plan.** No task runs `npm run supabase:db:push`, `scripts/supabase-exec.sh`, or any other command that writes schema to a live instance (local or the self-hosted VPS). Docker is unavailable in this environment (confirmed: no local Supabase can be started here), and the self-hosted instance is shared production-adjacent infrastructure — applying the migration is a separately-confirmed step the human takes, not this plan.
- The harness verification task (Task 6) proves the widget renders and passes gates **without** touching any database, using the existing `VITE_FEATURE_FLAG_OVERRIDES` JSON-map env var (`src/lib/feature-flags.ts`'s `resolveFeatureFlagEnvOverride`) to force the flag on for that one test run — the same pattern `DS_HARNESS=1` already uses for the CSP gate.
- Supabase `Database` types have not been regenerated for the new table (that requires an applied migration). The widget and its test file reference the table through one local, explicit TypeScript interface plus a narrow `as any` cast on `.from('ux_feedback')` — the same documented idiom already used in this repo for an untyped relation (`src/tests/integration/container_logic.test.ts`'s view-query comment: "cast the untyped relation name instead of pretending it is typed"). Re-running `npm run supabase:types:gen` after the migration is applied is noted as a follow-up, not done here.
- Widget UI: 44×44 floating button, `fixed bottom-6 right-6 z-40` (below the app's `z-50` dialogs/alert-dialogs/toasts — confirmed via `src/components/ui/alert-dialog.tsx`), `aria-label="Give feedback"`. Popover form: Select (task) → RadioGroup (completed) → 1–5 segmented control (ease) → Textarea (comment, optional, 500 char cap). Escape closes the popover and returns focus to the trigger button (Radix `Popover`'s default behavior — verify, don't reimplement).
- Every commit ends with: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
- Tests: RTL + vitest for the widget; the export script's markdown-building logic is a pure function, unit-tested the same way `docs/design-system/verification/generate-report.mjs`'s `buildReport` is (import the function, assert on fixture rows). Run only the files you touch — this repo's full `npm test` takes over an hour; never run it inside a task.
- No `.mjs` script in this plan gets a `#!/usr/bin/env node` shebang if it is ever imported by a test file (see `docs/design-system/verification/generate-report.mjs`'s own header comment for why — Vite's SSR test transform breaks on a shebang that isn't the file's literal first line once the file is cross-imported).
- Repo is `"type": "module"`: no bare `__dirname`/`require` in new `.mjs`/harness-adjacent files.

---

## File structure

| Path | Responsibility |
|---|---|
| `supabase/migrations/20260915000000_create_ux_feedback.sql` | (Task 1) `ux_feedback` table, indexes, RLS policies, `platform.feature_flags` seed row |
| `supabase/tests/ux_feedback_rls.sql` | (Task 1) DO-block smoke test in the repo's existing `supabase/tests/*.sql` convention — written for later manual/local execution, not run by this plan |
| `src/lib/feature-flags.ts` | (Task 2) add `UX_FEEDBACK_WIDGET` key |
| `src/config/uxRounds.ts` | (Task 2) `{ activeRound, rounds: { [n]: { tasks: {id,label}[] } } }` — single source for widget + docs |
| `src/config/uxRounds.test.ts` | (Task 2) shape tests |
| `src/components/feedback/UxFeedbackWidget.tsx` | (Task 3) the widget |
| `src/components/feedback/UxFeedbackWidget.test.tsx` | (Task 3) RTL tests |
| `src/components/layout/DashboardLayout.tsx` | (Task 4) mount point (modify) |
| `docs/design-system/usability/PROTOCOL.md` | (Task 5) participants, moderator script, round-1 tasks |
| `docs/design-system/usability/round-template.md` | (Task 5) per-round write-up template |
| `docs/design-system/usability/export.mjs` | (Task 5) `buildRoundMarkdown` + CLI |
| `docs/design-system/usability/export.test.mjs` | (Task 5) unit tests for `buildRoundMarkdown` |
| `docs/design-system/README.md` | (Task 6) §9 "Usability testing" |
| `docs/design-system/verification/**` | (Task 6) re-generated evidence for the widget's presence on every page |

---

### Task 1: Migration and RLS smoke test

**Files:**
- Create: `supabase/migrations/20260915000000_create_ux_feedback.sql`
- Create: `supabase/tests/ux_feedback_rls.sql`

**Interfaces:**
- Produces: table `public.ux_feedback` with columns exactly as in Global Constraints; a `platform.feature_flags` row `key='ux_feedback_widget', enabled=false`.

- [ ] **Step 1: Write the migration**

`supabase/migrations/20260915000000_create_ux_feedback.sql`:
```sql
-- Plan 3 (usability feedback apparatus) — see
-- docs/superpowers/specs/2026-09-13-design-system-verification-and-usability-design.md §5.1
-- and docs/superpowers/plans/2026-09-15-usability-feedback-apparatus.md.
--
-- NOT APPLIED by any automated process. Apply locally (supabase db reset)
-- or to the self-hosted instance only after explicit confirmation — see
-- the plan's Global Constraints.

CREATE TABLE public.ux_feedback (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  round        smallint NOT NULL,
  task_id      text,
  route        text NOT NULL,
  completed    text CHECK (completed IN ('yes', 'partial', 'no')),
  ease         smallint CHECK (ease BETWEEN 1 AND 5),
  comment      text,
  viewport_w   integer,
  viewport_h   integer,
  theme_mode   text,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ux_feedback IS
  'In-app usability-round feedback (Plan 3). One row per widget submission.';

CREATE INDEX ux_feedback_tenant_round_idx ON public.ux_feedback (tenant_id, round);
CREATE INDEX ux_feedback_round_task_idx   ON public.ux_feedback (round, task_id);

ALTER TABLE public.ux_feedback ENABLE ROW LEVEL SECURITY;

-- Any authenticated user may insert exactly one row for themself, scoped to
-- their own tenant (public.get_user_tenant_id resolves the caller's tenant
-- from public.user_roles — see 20251001011353_..., role IN ('tenant_admin',
-- 'franchise_admin','user'), so this covers ordinary staff, not just admins).
CREATE POLICY ux_feedback_insert_own ON public.ux_feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND tenant_id = public.get_user_tenant_id((SELECT auth.uid()))
  );

-- Tenant admins (and franchise admins) read their own tenant's rows;
-- platform admin reads everything.
CREATE POLICY ux_feedback_select_admin ON public.ux_feedback
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin((SELECT auth.uid()))
    OR (
      tenant_id = public.get_user_tenant_id((SELECT auth.uid()))
      AND (
        public.has_role((SELECT auth.uid()), 'tenant_admin'::public.app_role)
        OR public.has_role((SELECT auth.uid()), 'franchise_admin'::public.app_role)
      )
    )
  );

-- No UPDATE or DELETE policies: RLS denies both by default once enabled,
-- and feedback rows are immutable by design (spec §5.1: "no update/delete
-- from clients").

-- Feature flag, disabled by default. Uses platform.feature_flags (schema
-- "platform", not "public" — see 20260516080945_platform_feature_flags.sql).
INSERT INTO platform.feature_flags (key, name, description, enabled, tags)
VALUES (
  'ux_feedback_widget',
  'Usability feedback widget',
  'Floating in-app widget collecting task-completion/ease/comment feedback for a usability-testing round. See docs/design-system/usability/PROTOCOL.md.',
  false,
  ARRAY['design-system']
)
ON CONFLICT (key) DO NOTHING;
```

- [ ] **Step 2: Write the RLS smoke test**

`supabase/tests/ux_feedback_rls.sql`, matching the repo's existing `DO $$ ... $$` convention (see `supabase/tests/compliance_override.sql` for the pattern this follows) — self-contained, self-cleaning, asserts via `RAISE EXCEPTION`:
```sql
-- ux_feedback RLS smoke test (Plan 3). Run manually against a database with
-- the 20260915000000_create_ux_feedback.sql migration applied — local dev
-- (supabase db reset) or the self-hosted instance, never automatically.
-- Run with: npm run supabase:exec -- supabase/tests/ux_feedback_rls.sql
-- (or psql against a local instance). Self-cleaning; failure aborts + rolls
-- back (no residue on failure; on success the two synthetic rows this test
-- creates are deleted in the final cleanup block).
--
-- Asserts:
--   A1. A user can insert a ux_feedback row for their own tenant/user_id.
--   A2. The SAME user cannot insert a row claiming a DIFFERENT tenant_id
--       (RLS WITH CHECK on ux_feedback_insert_own rejects it).
--   A3. A second, unrelated tenant's user cannot SELECT the first tenant's
--       row (RLS USING on ux_feedback_select_admin rejects it for a
--       non-admin role).
--   A4. A tenant_admin in the SAME tenant CAN select the row.
--   A5. No UPDATE policy exists: an UPDATE from the owning user is rejected.

DO $$
DECLARE
  v_tenant_a uuid; v_tenant_b uuid;
  v_user_a uuid; v_user_b uuid; v_admin_a uuid;
  v_row_id uuid;
  v_count integer;
BEGIN
  -- Borrow three distinct EXISTING auth.users ids rather than inserting new
  -- ones: auth.users is GoTrue-managed with ~30 required columns (see
  -- supabase/migration-package/direct-migration/scripts/sync-auth.js for the
  -- full INSERT), so fabricating rows there directly is fragile across
  -- GoTrue versions and is not what this test is for. Tenants and
  -- user_roles ARE created fresh and are fully self-contained/cleaned up
  -- below -- only the auth.users identities themselves are borrowed, never
  -- modified or deleted. public.user_roles' uniqueness is per
  -- (user_id, role, tenant_id, franchise_id), so granting a borrowed user a
  -- role in a brand-new synthetic tenant cannot collide with whatever real
  -- roles that user already has elsewhere.
  -- Precondition: the target database has at least 3 distinct auth.users
  -- rows (true for any real dev/self-hosted instance that has real users;
  -- this is the same "borrow real seed data" convention already used by
  -- supabase/tests/markets_multibroker_rls.sql for the same reason).
  SELECT id INTO v_user_a FROM auth.users ORDER BY id LIMIT 1;
  SELECT id INTO v_user_b FROM auth.users WHERE id <> v_user_a ORDER BY id LIMIT 1;
  SELECT id INTO v_admin_a FROM auth.users WHERE id NOT IN (v_user_a, v_user_b) ORDER BY id LIMIT 1;

  IF v_user_a IS NULL OR v_user_b IS NULL OR v_admin_a IS NULL THEN
    RAISE NOTICE 'ux_feedback_rls.sql: skipped -- needs at least 3 distinct auth.users rows in this database.';
    RETURN;
  END IF;

  -- Fixture: two fresh tenants, borrowed user_a/user_b as a plain 'user' in
  -- each, borrowed admin_a as tenant_admin in tenant A. slug must be
  -- NOT NULL UNIQUE (public.tenants) -- suffix with a fresh uuid so reruns
  -- never collide.
  INSERT INTO public.tenants (id, name, slug)
    VALUES (gen_random_uuid(), '[smoke_test] UX FB Tenant A', '_smoke_test_ux_fb_tenant_a_' || gen_random_uuid())
    RETURNING id INTO v_tenant_a;
  INSERT INTO public.tenants (id, name, slug)
    VALUES (gen_random_uuid(), '[smoke_test] UX FB Tenant B', '_smoke_test_ux_fb_tenant_b_' || gen_random_uuid())
    RETURNING id INTO v_tenant_b;
  INSERT INTO public.user_roles (user_id, role, tenant_id) VALUES (v_user_a, 'user', v_tenant_a);
  INSERT INTO public.user_roles (user_id, role, tenant_id) VALUES (v_user_b, 'user', v_tenant_b);
  INSERT INTO public.user_roles (user_id, role, tenant_id) VALUES (v_admin_a, 'tenant_admin', v_tenant_a);

  -- A1: user_a inserts their own row for their own tenant.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a)::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.ux_feedback (tenant_id, user_id, round, route, completed, ease)
  VALUES (v_tenant_a, v_user_a, 1, '/dashboard/leads', 'yes', 4)
  RETURNING id INTO v_row_id;
  RESET ROLE;

  -- A2: user_a tries to insert claiming tenant_b — must fail.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a)::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.ux_feedback (tenant_id, user_id, round, route, completed, ease)
    VALUES (v_tenant_b, v_user_a, 1, '/dashboard/leads', 'yes', 4);
    RAISE EXCEPTION 'A2 FAILED: cross-tenant insert should have been rejected by RLS';
  EXCEPTION WHEN insufficient_privilege OR others THEN
    IF SQLERRM = 'A2 FAILED: cross-tenant insert should have been rejected by RLS' THEN RAISE; END IF;
    NULL; -- expected: RLS rejects the row
  END;
  RESET ROLE;

  -- A3: user_b (different tenant, no admin role) cannot see tenant_a's row.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_b)::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM public.ux_feedback WHERE id = v_row_id;
  RESET ROLE;
  IF v_count != 0 THEN RAISE EXCEPTION 'A3 FAILED: user_b should not see tenant_a''s row, saw %', v_count; END IF;

  -- A4: admin_a (tenant_admin, same tenant) CAN see it.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_a)::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM public.ux_feedback WHERE id = v_row_id;
  RESET ROLE;
  IF v_count != 1 THEN RAISE EXCEPTION 'A4 FAILED: tenant_admin should see the row, saw %', v_count; END IF;

  -- A5: no UPDATE policy — the owning user's UPDATE is rejected.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a)::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE public.ux_feedback SET ease = 5 WHERE id = v_row_id;
    RAISE EXCEPTION 'A5 FAILED: update should have been rejected (no UPDATE policy)';
  EXCEPTION WHEN insufficient_privilege OR others THEN
    IF SQLERRM = 'A5 FAILED: update should have been rejected (no UPDATE policy)' THEN RAISE; END IF;
    NULL; -- expected
  END;
  RESET ROLE;

  -- Cleanup (service-role context restored by RESET ROLE above). Only the
  -- synthetic tenants/roles/feedback row this test created are removed;
  -- the borrowed auth.users rows (v_user_a/v_user_b/v_admin_a) are never
  -- touched -- they are real accounts this test does not own.
  DELETE FROM public.ux_feedback WHERE tenant_id IN (v_tenant_a, v_tenant_b);
  DELETE FROM public.user_roles WHERE tenant_id IN (v_tenant_a, v_tenant_b);
  DELETE FROM public.tenants WHERE id IN (v_tenant_a, v_tenant_b);

  RAISE NOTICE 'ux_feedback_rls.sql: all assertions passed (A1-A5)';
END $$;
```

- [ ] **Step 3: Verify the SQL is well-formed (no live database available)**

There is no local Postgres/Docker in this environment and this plan must not touch the self-hosted instance. Verify by careful re-read instead:
- Confirm every column in the `INSERT`/`UPDATE` statements in the smoke test matches the migration's column list exactly (name and order-independent, since inserts use named columns).
- Confirm `public.get_user_tenant_id`, `public.is_platform_admin`, `public.has_role`, and `public.user_roles`/`public.tenants` referenced here match the signatures found in `supabase/migrations/20251001011353_c6e4a402-3e6e-47c7-b19a-69d07c258f65.sql` and `20260128100001_fix_profiles_rls.sql` (re-read both files and diff the names/argument types against what you wrote).
- Confirm `platform.feature_flags` columns (`key, name, description, enabled, tags`) match `supabase/migrations/20260516080945_platform_feature_flags.sql`'s `CREATE TABLE` exactly.
- Confirm `public.tenants`' NOT NULL columns (`name`, `slug` — both `UNIQUE`) are both supplied in every `INSERT INTO public.tenants` in the smoke test.
- Confirm the smoke test never inserts into `auth.users` or `public.profiles` directly (both are FK-heavy, GoTrue/profile-managed tables outside this task's scope) — it only ever `SELECT`s existing `auth.users.id` values and references them.
Record in your report which files you cross-checked and that the names matched.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260915000000_create_ux_feedback.sql supabase/tests/ux_feedback_rls.sql
git commit -m "feat(ux-feedback): ux_feedback table, RLS policies, disabled feature flag seed

Not applied to any database (see file header + plan Global Constraints)."
```

---

### Task 2: Feature flag key and round config

**Files:**
- Modify: `src/lib/feature-flags.ts`
- Create: `src/config/uxRounds.ts`
- Test: `src/config/uxRounds.test.ts`

**Interfaces:**
- Consumes: `useAppFeatureFlag` from `src/lib/feature-flags.ts` (already exists — signature `useAppFeatureFlag(key: FeatureFlagKey, defaultValue?: boolean): { enabled: boolean; isLoading: boolean; error: unknown }`).
- Produces: `FEATURE_FLAGS.UX_FEEDBACK_WIDGET = 'ux_feedback_widget'`; from `src/config/uxRounds.ts`: `export interface UxTask { id: string; label: string }`, `export interface UxRound { tasks: UxTask[] }`, `export const UX_ROUNDS: { activeRound: number; rounds: Record<number, UxRound> }`, `export function activeRoundTasks(): UxTask[]`.

- [ ] **Step 1: Write the failing test**

`src/config/uxRounds.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { UX_ROUNDS, activeRoundTasks } from './uxRounds';

describe('uxRounds', () => {
  it('has a valid activeRound pointing at a defined round', () => {
    expect(UX_ROUNDS.rounds[UX_ROUNDS.activeRound]).toBeDefined();
  });

  it('every round has at least one task with a non-empty id and label', () => {
    for (const round of Object.values(UX_ROUNDS.rounds)) {
      expect(round.tasks.length).toBeGreaterThan(0);
      for (const task of round.tasks) {
        expect(task.id.length).toBeGreaterThan(0);
        expect(task.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('task ids are unique within a round', () => {
    for (const round of Object.values(UX_ROUNDS.rounds)) {
      const ids = round.tasks.map(t => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('activeRoundTasks() returns the active round\'s tasks', () => {
    expect(activeRoundTasks()).toEqual(UX_ROUNDS.rounds[UX_ROUNDS.activeRound].tasks);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/config/uxRounds.test.ts`
Expected: FAIL — cannot resolve `./uxRounds`.

- [ ] **Step 3: Add the flag key**

In `src/lib/feature-flags.ts`, inside the `FEATURE_FLAGS` object (after `DOMAIN_GROUPED_NAV`), add:
```ts
  /**
   * Plan 3 (usability feedback apparatus) — floating in-app widget that
   * collects task-completion/ease/comment feedback for a usability-testing
   * round. Default off; enabled per pilot tenant while a round is running.
   * See docs/design-system/usability/PROTOCOL.md and src/config/uxRounds.ts.
   */
  UX_FEEDBACK_WIDGET: 'ux_feedback_widget',
```

- [ ] **Step 4: Write `src/config/uxRounds.ts`**

Round 1's task list matches `docs/superpowers/specs/2026-09-13-design-system-verification-and-usability-design.md` §5.3 exactly:
```ts
// Single source of the active usability-testing round and its tasks — read
// by UxFeedbackWidget (the Select options) and docs/design-system/usability/
// PROTOCOL.md (kept in sync by hand; PROTOCOL.md's round-1 list must match
// round 1 here). See docs/superpowers/specs/2026-09-13-design-system-
// verification-and-usability-design.md §5.3-5.4.

export interface UxTask {
  id: string;
  label: string;
}

export interface UxRound {
  tasks: UxTask[];
}

export const UX_ROUNDS: { activeRound: number; rounds: Record<number, UxRound> } = {
  activeRound: 1,
  rounds: {
    1: {
      tasks: [
        { id: 'find-open-lead', label: 'Find the lead for a given company and open it' },
        { id: 'move-opportunity-stage', label: "Move that lead's opportunity to the next stage on the pipeline board" },
        { id: 'create-contact', label: 'Create a new contact against the same account' },
        { id: 'switch-dark-mode', label: 'Switch the interface to dark mode' },
        { id: 'filter-todays-activities', label: "Show only today's activities" },
      ],
    },
  },
};

export function activeRoundTasks(): UxTask[] {
  return UX_ROUNDS.rounds[UX_ROUNDS.activeRound].tasks;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/config/uxRounds.test.ts`
Expected: 4 passed.

- [ ] **Step 6: Typecheck the touched files**

Run: `npx tsc --noEmit -p tsconfig.typecheck.json 2>&1 | grep -E "uxRounds|feature-flags"`
Expected: no output (no new errors in these two files — the repo has ~480 pre-existing unrelated errors elsewhere; that baseline is documented, don't chase it).

- [ ] **Step 7: Commit**

```bash
git add src/lib/feature-flags.ts src/config/uxRounds.ts src/config/uxRounds.test.ts
git commit -m "feat(ux-feedback): UX_FEEDBACK_WIDGET flag key and round-1 task config"
```

---

### Task 3: The widget

**Files:**
- Create: `src/components/feedback/UxFeedbackWidget.tsx`
- Test: `src/components/feedback/UxFeedbackWidget.test.tsx`

**Interfaces:**
- Consumes: `FEATURE_FLAGS`, `useAppFeatureFlag` (Task 2's `src/lib/feature-flags.ts`); `activeRoundTasks`, `UX_ROUNDS` (Task 2's `src/config/uxRounds.ts`); `useCRM()` from `@/hooks/useCRM` (existing — returns `{ supabase, user, context }` where `context.tenantId: string`, `user.id: string`, matching the pattern in `src/pages/dashboard/OpportunityNew.tsx`); `toast` from `sonner` (existing convention, see `src/components/layout/DashboardLayout.tsx:27`); `Popover`/`PopoverTrigger`/`PopoverContent` from `@/components/ui/popover`; `RadioGroup`/`RadioGroupItem` from `@/components/ui/radio-group`; `Select`/`SelectTrigger`/`SelectContent`/`SelectItem`/`SelectValue` from `@/components/ui/select`; `Textarea` from `@/components/ui/textarea`; `Button` from `@/components/ui/button`; `Label` from `@/components/ui/label`.
- Produces: `export function UxFeedbackWidget(): JSX.Element | null` — renders nothing when the flag is off; default export is not used (named export, matching this repo's component convention, e.g. `DomainSwitcher`).

- [ ] **Step 1: Write the failing tests**

`src/components/feedback/UxFeedbackWidget.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UxFeedbackWidget } from './UxFeedbackWidget';

const mockUseAppFeatureFlag = vi.fn();
vi.mock('@/lib/feature-flags', async () => {
  const actual = await vi.importActual<typeof import('@/lib/feature-flags')>('@/lib/feature-flags');
  return { ...actual, useAppFeatureFlag: (...args: unknown[]) => mockUseAppFeatureFlag(...args) };
});

const mockInsert = vi.fn().mockResolvedValue({ error: null });
vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    supabase: { from: () => ({ insert: mockInsert }) },
    user: { id: 'user-1' },
    context: { tenantId: 'tenant-1' },
  }),
}));

beforeEach(() => {
  mockUseAppFeatureFlag.mockReset();
  mockInsert.mockClear();
});

describe('UxFeedbackWidget', () => {
  it('renders nothing when the flag is off', () => {
    mockUseAppFeatureFlag.mockReturnValue({ enabled: false, isLoading: false, error: null });
    const { container } = render(<UxFeedbackWidget />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a named, focusable trigger button when the flag is on', () => {
    mockUseAppFeatureFlag.mockReturnValue({ enabled: true, isLoading: false, error: null });
    render(<UxFeedbackWidget />);
    expect(screen.getByRole('button', { name: 'Give feedback' })).toBeInTheDocument();
  });

  it('submits the expected row shape and shows a success toast', async () => {
    mockUseAppFeatureFlag.mockReturnValue({ enabled: true, isLoading: false, error: null });
    const user = userEvent.setup();
    render(<UxFeedbackWidget />);

    await user.click(screen.getByRole('button', { name: 'Give feedback' }));
    await user.click(screen.getByRole('combobox', { name: /what were you trying to do/i }));
    await user.click(await screen.findByRole('option', { name: /find the lead/i }));
    await user.click(screen.getByRole('radio', { name: /^yes$/i }));
    await user.click(screen.getByRole('radio', { name: '4' }));
    await user.type(screen.getByRole('textbox', { name: /anything else/i }), 'Worked fine');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => expect(mockInsert).toHaveBeenCalledTimes(1));
    const row = mockInsert.mock.calls[0][0];
    expect(row).toMatchObject({
      tenant_id: 'tenant-1',
      user_id: 'user-1',
      round: 1,
      task_id: 'find-open-lead',
      completed: 'yes',
      ease: 4,
      comment: 'Worked fine',
      theme_mode: expect.any(String),
    });
    expect(typeof row.route).toBe('string');
    expect(typeof row.viewport_w).toBe('number');
    expect(typeof row.viewport_h).toBe('number');
    expect(typeof row.user_agent).toBe('string');
  });

  it('Escape closes the popover and returns focus to the trigger', async () => {
    mockUseAppFeatureFlag.mockReturnValue({ enabled: true, isLoading: false, error: null });
    const user = userEvent.setup();
    render(<UxFeedbackWidget />);
    const trigger = screen.getByRole('button', { name: 'Give feedback' });
    await user.click(trigger);
    expect(screen.getByRole('combobox', { name: /what were you trying to do/i })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('combobox', { name: /what were you trying to do/i })).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/feedback/UxFeedbackWidget.test.tsx`
Expected: FAIL — cannot resolve `./UxFeedbackWidget`.

- [ ] **Step 3: Implement the widget**

`src/components/feedback/UxFeedbackWidget.tsx`:
```tsx
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FEATURE_FLAGS, useAppFeatureFlag } from '@/lib/feature-flags';
import { useCRM } from '@/hooks/useCRM';
import { activeRoundTasks, UX_ROUNDS } from '@/config/uxRounds';

const OTHER_TASK_ID = '__other__';
type Completed = 'yes' | 'partial' | 'no';

// Row shape for public.ux_feedback (Plan 3). The Database type for this
// table does not exist yet -- the migration in
// supabase/migrations/20260915000000_create_ux_feedback.sql has not been
// applied to any database this codebase's generated types are drawn from.
// Cast at the call site (below) rather than pretending the relation is
// typed; re-run `npm run supabase:types:gen` once the migration lands and
// remove this interface + the cast.
interface UxFeedbackRow {
  tenant_id: string;
  user_id: string;
  round: number;
  task_id: string;
  route: string;
  completed: Completed;
  ease: number;
  comment: string | null;
  viewport_w: number;
  viewport_h: number;
  theme_mode: 'light' | 'dark';
  user_agent: string;
}

export function UxFeedbackWidget() {
  const { enabled } = useAppFeatureFlag(FEATURE_FLAGS.UX_FEEDBACK_WIDGET, false);
  const { supabase, user, context } = useCRM();
  const [open, setOpen] = useState(false);
  const [taskId, setTaskId] = useState('');
  const [completed, setCompleted] = useState<Completed | ''>('');
  const [ease, setEase] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!enabled) return null;

  const reset = () => {
    setTaskId('');
    setCompleted('');
    setEase('');
    setComment('');
  };

  const handleSubmit = async () => {
    if (!taskId || !completed || !ease || !user?.id || !context?.tenantId) return;
    setSubmitting(true);
    const isDark = document.documentElement.classList.contains('dark');
    const row: UxFeedbackRow = {
      tenant_id: context.tenantId,
      user_id: user.id,
      round: UX_ROUNDS.activeRound,
      task_id: taskId,
      route: window.location.pathname,
      completed,
      ease: Number(ease),
      comment: comment.trim() ? comment.trim().slice(0, 500) : null,
      viewport_w: window.innerWidth,
      viewport_h: window.innerHeight,
      theme_mode: isDark ? 'dark' : 'light',
      user_agent: navigator.userAgent,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see UxFeedbackRow comment above
    const { error } = await (supabase as any).from('ux_feedback').insert(row);
    setSubmitting(false);
    if (error) {
      toast.error('Could not save your feedback — please try again.');
      return;
    }
    toast.success('Thanks for the feedback!');
    reset();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon"
          aria-label="Give feedback"
          className="fixed bottom-6 right-6 z-40 h-11 w-11 rounded-full shadow-lg"
        >
          <FeedbackIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="ux-feedback-task">What were you trying to do?</Label>
          <Select value={taskId} onValueChange={setTaskId}>
            <SelectTrigger id="ux-feedback-task" aria-label="What were you trying to do?">
              <SelectValue placeholder="Choose a task" />
            </SelectTrigger>
            <SelectContent>
              {activeRoundTasks().map((task) => (
                <SelectItem key={task.id} value={task.id}>{task.label}</SelectItem>
              ))}
              <SelectItem value={OTHER_TASK_ID}>Something else</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Did you complete it?</Label>
          <RadioGroup value={completed} onValueChange={(v) => setCompleted(v as Completed)} className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="yes" id="ux-feedback-completed-yes" />
              <Label htmlFor="ux-feedback-completed-yes" className="font-normal">Yes</Label>
            </div>
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="partial" id="ux-feedback-completed-partial" />
              <Label htmlFor="ux-feedback-completed-partial" className="font-normal">Partially</Label>
            </div>
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="no" id="ux-feedback-completed-no" />
              <Label htmlFor="ux-feedback-completed-no" className="font-normal">No</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-1.5">
          <Label>How easy was it?</Label>
          <RadioGroup value={ease} onValueChange={setEase} className="flex justify-between">
            {(['1', '2', '3', '4', '5'] as const).map((n) => (
              <div key={n} className="flex flex-col items-center gap-1">
                <RadioGroupItem value={n} id={`ux-feedback-ease-${n}`} aria-label={n} />
                <Label htmlFor={`ux-feedback-ease-${n}`} className="text-xs font-normal">
                  {n === '1' ? 'Very hard' : n === '5' ? 'Very easy' : n}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ux-feedback-comment">Anything else?</Label>
          <Textarea
            id="ux-feedback-comment"
            aria-label="Anything else?"
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 500))}
            maxLength={500}
            rows={3}
          />
        </div>

        <Button
          type="button"
          className="w-full"
          disabled={!taskId || !completed || !ease || submitting}
          onClick={handleSubmit}
        >
          Submit
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function FeedbackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
```

Theme mode is read from the DOM's `dark` class (`document.documentElement.classList.contains('dark')`), not from `localStorage`'s `soslogicpro.darkMode` key, because the class reflects what actually rendered — no import from `@/lib/theme-storage-keys` is needed here.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/feedback/UxFeedbackWidget.test.tsx`
Expected: 4 passed.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.typecheck.json 2>&1 | grep -i "UxFeedbackWidget"`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/components/feedback/UxFeedbackWidget.tsx src/components/feedback/UxFeedbackWidget.test.tsx
git commit -m "feat(ux-feedback): UxFeedbackWidget — flag-gated task/ease/comment popover"
```

---

### Task 4: Mount in DashboardLayout

**Files:**
- Modify: `src/components/layout/DashboardLayout.tsx`

**Interfaces:**
- Consumes: `UxFeedbackWidget` (Task 3).

- [ ] **Step 1: Write the failing test**

Create `src/components/layout/DashboardLayout.uxFeedback.test.tsx` (a small, focused test file — do not bloat any existing `DashboardLayout.test.tsx` if one exists; check first with `ls src/components/layout/DashboardLayout.test.tsx` — if it exists, add this test to it instead, in its own `describe` block, matching its existing mock setup for `useAuth`/`useCRM`/etc.):
```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/feedback/UxFeedbackWidget', () => ({
  UxFeedbackWidget: () => <div data-testid="ux-feedback-widget-stub" />,
}));

// Mock everything DashboardLayout needs to render without a real provider
// tree -- copy the exact mock shape from this file's existing tests if
// DashboardLayout.test.tsx already exists; otherwise use the minimal set
// below and extend only if a specific hook throws when unmocked.
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, session: {}, signOut: vi.fn() }) }));
vi.mock('@/hooks/useCRM', () => ({ useCRM: () => ({ user: { id: 'u1' }, context: { tenantId: 't1' }, supabase: {} }) }));

import { DashboardLayout } from './DashboardLayout';

describe('DashboardLayout — ux feedback widget', () => {
  it('mounts UxFeedbackWidget once', () => {
    render(<MemoryRouter><DashboardLayout><div>content</div></DashboardLayout></MemoryRouter>);
    expect(screen.getAllByTestId('ux-feedback-widget-stub')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/layout/DashboardLayout.uxFeedback.test.tsx` (or the file you added it to)
Expected: FAIL — `ux-feedback-widget-stub` not found (component not yet mounted). If the render itself throws because some other hook needs mocking, add the minimal mock for that hook and re-run — do not weaken the test's assertion.

- [ ] **Step 3: Mount it**

In `src/components/layout/DashboardLayout.tsx`, add the import near the other component imports (after `import { HelpDialog } from '@/components/system/HelpDialog';`):
```tsx
import { UxFeedbackWidget } from '@/components/feedback/UxFeedbackWidget';
```
Then render it once, as a sibling near the end of the component's top-level return (find the closing of the outermost returned element — the `</main>` you saw at line ~786 is inside a larger wrapper; add `<UxFeedbackWidget />` as a sibling right before that wrapper's own closing tag, alongside `OnboardingTour`/`ConsentBanner`/`HelpDialog` which are already mounted the same way — match their exact placement pattern, do not nest it inside `<main>`).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/layout/DashboardLayout.uxFeedback.test.tsx`
Expected: 1 passed.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.typecheck.json 2>&1 | grep -i "DashboardLayout"`
Expected: no NEW errors attributable to this change (the repo has pre-existing unrelated errors; compare against `git stash` if anything appears, per this branch's established convention).

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/DashboardLayout.tsx src/components/layout/DashboardLayout.uxFeedback.test.tsx
git commit -m "feat(ux-feedback): mount UxFeedbackWidget in DashboardLayout"
```

---

### Task 5: Protocol docs and export script

**Files:**
- Create: `docs/design-system/usability/PROTOCOL.md`
- Create: `docs/design-system/usability/round-template.md`
- Create: `docs/design-system/usability/export.mjs`
- Test: `docs/design-system/usability/export.test.mjs`

**Interfaces:**
- Produces: `export function buildRoundMarkdown(rows, round)` (pure, from `export.mjs`) → a Markdown string with completion %, mean/median ease per task, and comments grouped by route.

- [ ] **Step 1: Write `PROTOCOL.md`**

```markdown
# Usability Testing Protocol

**Status:** No rounds have run yet. This document is the protocol; round
write-ups live in `round-N.md` files that only exist once real sessions
have happened — see [Iteration loop](#iteration-loop).

## Participants

- 5–8 people per round, drawn from real sales and operations roles (not
  engineering).
- At least one participant testing on a 360–768px-wide device (phone or
  small tablet), matching the design system's verified breakpoints
  (`docs/design-system/verification/REPORT.md`).
- At least one first-time user of the product (no prior exposure) per
  round, to catch onboarding friction the rest of the team is now blind to.

## Moderator script

- Think-aloud: ask the participant to narrate what they're looking for and
  why, not just what they're clicking.
- Do not lead. If a participant is stuck, wait at least 15 seconds before
  the mildest possible nudge ("what would you try next?"), never "click
  the X button."
- Do not explain a UI element's purpose before they've attempted the task —
  that's the finding, not noise to route around.
- Time-box each task at 3 minutes; if not complete, mark it `no` and move on
  — a failed task is data, not a moderator failure.
- Consent line, read verbatim before starting: "We're testing the product,
  not you — there's no wrong way to use it, and anything that trips you up
  is something we want to fix. Is it OK if we record your screen and voice
  for this session, and if I collect this feedback here on the record?"

## Round 1 tasks

(Must match `src/config/uxRounds.ts`'s `UX_ROUNDS.rounds[1].tasks` — if you
change one, change both.)

1. Find the lead for a given company and open it.
2. Move that lead's opportunity to the next stage on the pipeline board.
3. Create a new contact against the same account.
4. Switch the interface to dark mode.
5. Show only today's activities.

## Iteration loop

1. Bump `UX_ROUNDS.activeRound` in `src/config/uxRounds.ts`; enable the
   `ux_feedback_widget` flag for the pilot tenant at
   `/dashboard/settings/feature-flags`; run sessions using the moderator
   script above, with participants submitting feedback through the widget
   as they go (or immediately after each task).
2. `node docs/design-system/usability/export.mjs --round N` → paste its
   output into a new `round-N.md` (copy `round-template.md` as the
   starting point); rank findings by severity × frequency; decide fix /
   defer / won't-fix per finding.
3. Implement fixes; `npm run audit:design-system` must stay green; commit
   referencing `round-N`.
4. Repeat. **Minimum three rounds before any "validated" claim enters
   `docs/design-system/README.md`.**
5. `docs/design-system/README.md` §9 links this file, every `round-N.md`,
   and states the current round status.
```

- [ ] **Step 2: Write `round-template.md`**

```markdown
# Usability round N — <date>

**Participants:** N (roles: …)
**Tasks tested:** round <N> from `src/config/uxRounds.ts`

## Quantitative summary

<paste the output of `node docs/design-system/usability/export.mjs --round N` here verbatim>

## Findings

| # | Finding | Severity | Frequency (of N participants) | Task(s) |
|---|---|---|---|---|
| 1 | | Critical / Major / Minor | | |

## Decisions

| Finding # | Decision | Reasoning | Commit |
|---|---|---|---|---|
| 1 | Fix / Defer / Won't fix | | |

## Before/after evidence

Link the relevant `docs/design-system/verification/screenshots/**` paths
for any page a fix touched, from the harness run nearest each commit above.
```

- [ ] **Step 3: Write the failing test for `export.mjs`**

`docs/design-system/usability/export.test.mjs`:
```js
import { describe, expect, it } from 'vitest';
import { buildRoundMarkdown } from './export.mjs';

const ROWS = [
  { task_id: 'find-open-lead', route: '/dashboard/leads', completed: 'yes', ease: 4, comment: 'Easy once I saw the search box' },
  { task_id: 'find-open-lead', route: '/dashboard/leads', completed: 'no', ease: 2, comment: null },
  { task_id: 'move-opportunity-stage', route: '/dashboard/leads/pipeline', completed: 'partial', ease: 3, comment: 'Drag felt fragile' },
];

describe('buildRoundMarkdown', () => {
  const md = buildRoundMarkdown(ROWS, 1);

  it('reports completion % per task', () => {
    // find-open-lead: 1 of 2 fully completed = 50%
    expect(md).toMatch(/find-open-lead[\s\S]*?50%/);
  });

  it('reports mean and median ease per task', () => {
    // find-open-lead ease values [4, 2] -> mean 3, median 3
    expect(md).toMatch(/find-open-lead[\s\S]*?mean 3(\.0)?[\s\S]*?median 3/);
  });

  it('groups comments by route, omitting null comments', () => {
    expect(md).toContain('/dashboard/leads');
    expect(md).toContain('Easy once I saw the search box');
    expect(md).not.toMatch(/\/dashboard\/leads[\s\S]*?null/);
  });

  it('handles zero rows for a round without throwing', () => {
    expect(() => buildRoundMarkdown([], 2)).not.toThrow();
    expect(buildRoundMarkdown([], 2)).toContain('No feedback rows for round 2');
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npx vitest run docs/design-system/usability/export.test.mjs`
Expected: FAIL — cannot resolve `./export.mjs`.

- [ ] **Step 5: Write `export.mjs`**

No shebang (see Global Constraints — this file is cross-imported by its own test):
```js
// Queries public.ux_feedback for one round and prints the quantitative
// half of that round's docs/design-system/usability/round-N.md. Pure
// `buildRoundMarkdown` + a thin CLI reading from Supabase directly.
//
// Usage: node docs/design-system/usability/export.mjs --round N
// Requires SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_URL in the
// gitignored repo-root `env` file (never committed — see the design-
// system README's secrets convention).
import { pathToFileURL } from 'node:url';

export function buildRoundMarkdown(rows, round) {
  if (rows.length === 0) return `No feedback rows for round ${round} yet.`;

  const byTask = new Map();
  for (const r of rows) {
    if (!byTask.has(r.task_id)) byTask.set(r.task_id, []);
    byTask.get(r.task_id).push(r);
  }

  const lines = [];
  lines.push(`## Round ${round} — quantitative summary`);
  lines.push('');
  lines.push(`${rows.length} feedback row(s) across ${byTask.size} task(s).`);
  lines.push('');
  lines.push('| Task | Completed (yes) | Ease (mean / median) | N |');
  lines.push('|---|---|---|---|');
  for (const [taskId, taskRows] of byTask) {
    const completedCount = taskRows.filter(r => r.completed === 'yes').length;
    const pct = Math.round((completedCount / taskRows.length) * 100);
    const easeValues = taskRows.map(r => r.ease).filter(e => typeof e === 'number').sort((a, b) => a - b);
    const mean = easeValues.length ? (easeValues.reduce((a, b) => a + b, 0) / easeValues.length) : NaN;
    const median = easeValues.length
      ? (easeValues.length % 2 === 1
          ? easeValues[(easeValues.length - 1) / 2]
          : (easeValues[easeValues.length / 2 - 1] + easeValues[easeValues.length / 2]) / 2)
      : NaN;
    lines.push(`| ${taskId} | ${pct}% (${completedCount}/${taskRows.length}) | mean ${mean.toFixed(1)} / median ${median} | ${taskRows.length} |`);
  }

  lines.push('');
  lines.push('## Comments by route');
  lines.push('');
  const byRoute = new Map();
  for (const r of rows) {
    if (!r.comment) continue;
    if (!byRoute.has(r.route)) byRoute.set(r.route, []);
    byRoute.get(r.route).push(r.comment);
  }
  if (byRoute.size === 0) {
    lines.push('_No comments left._');
  } else {
    for (const [route, comments] of byRoute) {
      lines.push(`**${route}**`);
      for (const c of comments) lines.push(`- ${c}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const roundIdx = args.indexOf('--round');
  const round = roundIdx >= 0 ? Number(args[roundIdx + 1]) : NaN;
  if (!Number.isInteger(round)) {
    console.error('Usage: node export.mjs --round N');
    process.exitCode = 1;
    return;
  }
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — put them in the gitignored repo-root `env` file.');
    process.exitCode = 1;
    return;
  }
  const supabase = createClient(url, key);
  const { data, error } = await supabase.from('ux_feedback').select('*').eq('round', round);
  if (error) {
    console.error('Query failed:', error.message);
    process.exitCode = 1;
    return;
  }
  console.log(buildRoundMarkdown(data ?? [], round));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(err => { console.error(err); process.exitCode = 1; });
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run docs/design-system/usability/export.test.mjs`
Expected: 4 passed.

- [ ] **Step 7: Sanity-check the CLI path without a database**

Run: `node docs/design-system/usability/export.mjs --round 1`
Expected: prints the "Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" message and exits 1 (proves the main-guard fires and the argument parsing works, without needing real credentials — do not add real credentials to any file in this task).

- [ ] **Step 8: Lint**

Run: `npx eslint docs/design-system/usability/export.mjs`
Expected: clean (ESLint's `ignores` list already excludes `docs/` broadly — if this reports "file ignored," that's expected and fine, matching `generate-report.mjs`'s own lint status).

- [ ] **Step 9: Commit**

```bash
git add docs/design-system/usability/PROTOCOL.md docs/design-system/usability/round-template.md docs/design-system/usability/export.mjs docs/design-system/usability/export.test.mjs
git commit -m "docs(ux-feedback): usability protocol, round template, export.mjs"
```

---

### Task 6: README §9, harness verification, final checks

**Files:**
- Modify: `docs/design-system/README.md`
- Regenerate: `docs/design-system/verification/**` (widget-focused slice only, not a full 4-engine baseline)

**Interfaces:**
- Consumes: everything from Tasks 1–5.

- [ ] **Step 1: Add README §9**

After the existing last numbered section (§8 change log — check the current section numbering first, since Plan 2's Task 12 may have added content; insert as the next number in sequence) add:

```markdown
## 9. Usability testing

A flag-gated in-app widget (`src/components/feedback/UxFeedbackWidget.tsx`,
behind `ux_feedback_widget`, default off) collects task-completion/ease/
comment feedback into `public.ux_feedback`. Full protocol, the round-1 task
list, and the iteration loop: [`usability/PROTOCOL.md`](usability/PROTOCOL.md).

**Status: no rounds have run.** No `round-N.md` files exist yet — none will
be fabricated. The apparatus (widget, table, export script) is built and
tested; real sessions are the next step, on the team's schedule.

To run a round: [`usability/PROTOCOL.md`](usability/PROTOCOL.md#iteration-loop).
Per-round write-ups, once they exist, will be listed here.
```

- [ ] **Step 2: Verify the widget passes the Plan 1 harness with the flag forced on**

The widget must not introduce a WCAG violation on any page. Force the flag
on for one harness run without touching any database, using the env-
override mechanism `src/lib/feature-flags.ts` already supports:

```bash
DS_HARNESS=1 VITE_FEATURE_FLAG_OVERRIDES='{"ux_feedback_widget":true}' npx vite --port 4173 --strictPort
```

In a second terminal (or background the above), run a focused chromium
slice covering the axe/keyboard/ARIA gates on two representative pages:
```bash
PLAYWRIGHT_REUSE_EXISTING_SERVER=true npx playwright test -c tests/design-system/playwright.design-system.config.ts --project=setup --project=chromium matrix.spec.ts keyboard.spec.ts aria.spec.ts -g "dashboard|leads-list"
```
Expected: no NEW `serious`/`critical` axe violations attributable to the
`aria-label="Give feedback"` button or its popover contents versus the
already-committed baseline for these two pages (`docs/design-system/
verification/REPORT.md`) — compare the axe violation list before/after;
a violation is "new" only if its target selector references the feedback
widget (`aria-label="Give feedback"`, `ux-feedback-*` ids) or a popover
form element. Also confirm the keyboard walk can Tab to the trigger button
and Escape closes it (matches Task 3's RTL test, now checked in a real
browser). Do NOT commit any regenerated screenshots/cell-JSON from this
slice — it's a verification-only run; the repo's committed evidence stays
Plan 2's baseline (this widget is off by default in real usage, so it
should not appear in the default-flag baseline evidence).

Stop the Vite server you started (`DS_HARNESS`/`VITE_FEATURE_FLAG_OVERRIDES`
process) when done.

- [ ] **Step 3: Run the full Task 1–5 test scope together**

Run: `npx vitest run src/config/uxRounds.test.ts src/components/feedback/UxFeedbackWidget.test.tsx src/components/layout/DashboardLayout.uxFeedback.test.tsx docs/design-system/usability/export.test.mjs`
Expected: all pass, 0 failures.

Run: `npx eslint src/components/feedback src/config/uxRounds.ts src/lib/feature-flags.ts src/components/layout/DashboardLayout.tsx docs/design-system/usability`
Expected: clean (the `docs/` warning from Task 5 Step 8 is expected and fine).

- [ ] **Step 4: Commit**

```bash
git add docs/design-system/README.md
git commit -m "docs(ux-feedback): README section 9 — usability testing apparatus, no rounds run yet"
```

- [ ] **Step 5: Final report to the human**

State plainly, in your task report: (a) the migration and RLS test are written but **not applied anywhere** — applying to local dev requires Docker (unavailable here) and applying to the self-hosted instance requires explicit confirmation per the plan's Global Constraints; (b) the widget is verified in isolation (RTL) and in one live-browser harness slice with the flag force-enabled via env override, but has never been exercised against a real `ux_feedback` table since none exists yet; (c) what the human needs to do to actually start round 1: apply the migration (confirm first), enable the flag for a pilot tenant via `/dashboard/settings/feature-flags`, run `PROTOCOL.md`'s sessions.

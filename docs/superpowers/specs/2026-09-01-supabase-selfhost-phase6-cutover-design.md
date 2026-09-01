# Self-Hosted Supabase Migration — Phase 6: Production Cutover - Design Specification

**Date:** 2026-09-01
**Scope:** Move live traffic from Supabase Cloud (`gzhxgoigflftharcmdqj`) to the self-hosted stack, inside a single announced maintenance window. This is the phase that makes every preceding phase actually count — Phases 1–5b built and verified the replacement; nothing of that is *in use* until this runs.
**Status:** Draft — pending audit pass and approval

## 1. Background

Phases 1–5b stood up a self-hosted Supabase-equivalent stack on the Coolify VPS and brought it to parity: the seven-container stack (Phase 1), ongoing logical replication of 795 tables across 21 schemas (Phase 2), storage sync (Phase 3), 109 edge functions (Phase 4), a GoTrue version match (Phase 5a), 103 users and 101 identities plus the `on_auth_user_created` trigger (Phase 5), JWKS verification of production's ES256 tokens (Phase 5b), and working outbound auth email (the SMTP repair). Production and self-hosted are now functionally equivalent for the application's purposes, and self-hosted has never served real traffic.

**What this phase is not:** a gradual migration, a canary, or a dual-write scheme. It is a single scheduled switch with a defined commitment point, chosen deliberately over lower-downtime alternatives because the application's clients cannot address two backends at once (see §1a) and because a short, well-rehearsed window is easier to reason about — and to abort — than a partial state.

## 1a. Findings established during this design pass

Every item here was verified live, not inferred. Several materially change the shape of the cutover.

**1. The cutover surface is many containers, not one — and naming is a trap.** *(Count corrected by §1b Finding A: the true figure is eleven running containers, not the ten Coolify applications stated below. The reasoning here stands; the enumeration method does not.)* Enumerating Coolify's 25 applications by env-var *keys* suggests 15 apps carry Supabase configuration. That list is wrong to act on. Grouping the **running containers by the value they actually resolve** gives the real picture:

| Points at | Containers | Action |
|---|---|---|
| `gzhxgoigflftharcmdqj` (production) | `frontend`, `crm-api`, `amro-api`, `uim-api`, `comms-api`, `compliance-api`, `finance-api`, `logistics-api`, `markets-worker` (+1) — **10 total** | **repoint** |
| `db.aviation.sosservices.online` / `avaipro-gateway` | the 5 `avaipro-*` apps | **do not touch** |
| `db.astral.sosservices.online` | `sos` | **do not touch** |
| `http://kong:8000` | self-hosted `functions` | already correct |

The `avaipro-*` applications belong to Aviation AI Pro, a **different Supabase project** that happens to share this VPS. Repointing them because they matched a `SUPABASE_*` key search would break an unrelated production system. The inventory must be built from resolved values, and re-derived at execution time rather than copied from this table.

**2. Only one of the ten needs an image rebuild; the other nine are env-var changes.** `frontend` receives `VITE_SUPABASE_URL` as a **Docker build argument** (`Dockerfile:23-33`: `ARG` → `ENV` → `RUN npm run build`), so the value is compiled into the static bundle. Changing it therefore requires a full image rebuild and redeploy, and so does reverting it. The nine backend services read `SUPABASE_URL`/`DATABASE_URL` at runtime, so they need only an env update and a restart.

Note the app *appears* to support runtime override — `src/integrations/supabase/client.ts:6-14` falls back to `window.__ENV__` / `window.__APP_CONFIG__`, and three other modules read the same. **Nothing populates either.** Every occurrence outside a test file is a reader. The fallback is dead code, so it cannot be used to make this cutover a config flip. Introducing a writer was considered and deliberately rejected for this phase (see §2 Non-Goals).

**3. Sequence values are not replicated, and this is a hard blocker.** PostgreSQL logical replication does not carry sequence state. Self-hosted has **28 sequences** across the non-system schemas and every one sampled reads `last_value = NULL` — never advanced. Production's are live:

| Sequence (`public`) | Production `last_value` | Self-hosted |
|---|---|---|
| `directives_directive_sequence_seq` | 22060 | never advanced |
| `maintenance_tasks_task_id_seq` | 7172 | never advanced |
| `maintenance_tasks_temp_id_seq` | 1095 | never advanced |
| `directive_frequency_temp_frequency_sequence_seq` | 989 | never advanced |
| `ata_codes_import_temp_id_seq` | 115 | never advanced |
| `task_categories_category_id_seq` | 70 | never advanced |
| `directives_type_directives_type_id_seq` | 28 | never advanced |
| `task_type_task_type_seq_seq` | 15 | never advanced |
| `billing_invoice_seq` | NULL | never advanced |

Without a sync step, the first insert into `maintenance_tasks` after cutover claims `task_id = 1` against 7,172 replicated rows — a primary-key violation at best, and silent duplication wherever a sequence backs a non-key column. The table above covers `public` only; the sync must sweep **all 21 application schemas**, and the values must be re-read at execution time because production keeps advancing them until writes stop.

**4. The commitment point is dropping the subscription, and it is sharper than it looks.** Replication currently flows production → self-hosted via subscription `phase2_public_migration_sub` (enabled). While it is running, self-hosted cannot safely take writes: incoming replicated rows would race application writes on the same tables. So the subscription must be dropped *before* the application is repointed — and from that instant, production and self-hosted begin diverging. Any write accepted by self-hosted afterwards is absent from production, so a rollback past that point is not a configuration reversal but a data-reconciliation exercise. Everything before the drop is rehearsal and costs nothing to abandon.

**5. Several previously-tracked "blockers" resolve themselves at cutover and should not hold it up.** The open items list carries `storage`, `realtime`, and the `functions` router as unable to verify production's ES256 tokens. That gap exists only while clients hold *production-issued* tokens. After cutover, users authenticate against self-hosted's GoTrue, which signs with the shared HS256 secret — exactly what those three already verify. Since sessions were deliberately not migrated (Phase 5 non-goal), every user re-authenticates at cutover anyway, so the window in which the gap could bite is the interval between the switch and each user's next sign-in, during which they are being sent to a login screen regardless. This reframes three standing items from blockers to non-issues for this phase.

## 1b. Audit pass (2026-09-01) — three corrections, one of which invalidates the §1a.1 inventory

**Finding A — the container inventory is wrong, and the method that produced it is also wrong.** §1a.1 says "10 containers" and derives them from Coolify's application list. Enumerating **running containers** by resolved value returns **eleven**, and two of them are not part of any current Coolify deployment:

- `amro-api` — image `logic-nexus-ai-amro-api` (a locally-built image, not a Coolify artefact), started 2026-07-08, `restart=unless-stopped`.
- `amro-api-container` — image `c7dfnatpn9gaq4g0hjweubeu:7d5d04db…` (an *older* Coolify build of amro-api, under a hand-chosen container name), started 2026-07-23.

Both carry `com.docker.compose.*` labels but neither is the live Coolify container for that app, which is `c7dfnatpn9gaq4g0hjweubeu-071742077856`. So **three** amro-api containers are running concurrently, all configured against production. Repointing through Coolify's API — the mechanism §3 step 8 assumes — would update exactly one of the three and leave two still pointed at Supabase Cloud with `restart=unless-stopped`.

This is precisely the split-brain §2 exists to prevent, and it would not have been caught by any check in the spec as drafted. Two corrections follow: the inventory must be derived from **running containers**, never from the Coolify application list; and the two orphans must be explicitly resolved before cutover — established as genuinely unused and stopped, or repointed alongside the rest. Deciding which is a task for the plan, but it must not be left implicit.

**Finding B — storage sync is a point-in-time copy, and §3 has no re-sync step.** The Phase 3 README states plainly that it is *"not ongoing replication: it's a point-in-time copy, re-run manually."* Any object uploaded to production after the last run would therefore be absent from self-hosted at cutover. §3 must gain a re-sync step immediately before the commitment point.

Severity is low in practice but the step is still required: production's newest object dates to **2026-03-18** (~5½ months old), so the corpus is effectively static, and current parity is verified — self-hosted's 9 objects versus production's 11 is fully explained (two production objects are contentless, so there is nothing to copy), with both sides' total byte size (155 kB) and per-object checksums matching. The README's existing "re-run the `owner`/`owner_id` check" cutover action should be folded into the same step rather than tracked separately.

**Finding C — connection-level checks cannot verify the cutover, which raises the stakes on the write test.** An obvious way to confirm nothing still talks to production is to inspect `pg_stat_activity` there. That does not work here: sampled during this pass, production shows only Supabase's own internal clients (`postgrest`/`authenticator`, `realtime_*`, `mgmt-api`, `postgres_exporter`), because the VPS services reach the database through the pooler and PostgREST rather than as direct clients. A stale container would therefore be invisible to that check while still issuing writes.

Consequence: §4's requirement 4 — perform a real application write and confirm it appears on self-hosted and **not** on production — is not merely the best check, it is the **only** reliable one, and it must be run per-service rather than once globally if the orphans from Finding A are kept alive. §4 should say so explicitly rather than leaving requirement 4 as one item among seven.

## 1c. Second audit finding (2026-09-01) — the production frontend is 138 commits stale, and that breaks cutover isolation

Discovered while preparing Task 1 for execution. The running `frontend` container was built from commit `7d5d04db`; `main` has since advanced **138 commits**, of which **52 files** are application code (`src/`, `package.json`, `Dockerfile`, `vite.config.ts`) totalling 4,152 insertions and 280 deletions. Coolify deploys this app from `main` with `git_commit_sha = 'HEAD'`, so **any** rebuild pulls all of it.

This matters far beyond a stale deploy. §3's cutover rebuilds the frontend to change `VITE_SUPABASE_URL` — and that rebuild would simultaneously ship 138 commits of application code that has never run in production. The window would then change two independent things at once: the backend moves to self-hosted, and a large release goes out. A failure could not be attributed to either, and rollback would have to undo both. That is the precise opposite of the single-variable discipline the rehearsal/commitment split exists to enforce.

**Decision (plan owner, 2026-09-01): pin the cutover build to `7d5d04db`** — the exact code already running — so the only thing that changes is the Supabase build arguments. The 138 pending commits ship later as their own release, on their own schedule, with their own verification. Cutover stays a single-variable change.

Two consequences for §3 and for the plan: the build-timing measurement must **not** be taken by triggering a live Coolify rebuild (it would deploy those commits); and the cutover's frontend build must explicitly pin the commit rather than tracking `HEAD`, with the pinning mechanism verified before the window rather than discovered during it.

## 2. Goals / Non-Goals

**Goals:**
- All 10 production-facing containers resolve to the self-hosted stack, verified by their running configuration rather than by intent.
- Every sequence across all 21 application schemas is advanced past production's value before self-hosted accepts a single write.
- Replication is stopped cleanly, with confirmed zero lag, before the switch — no rows in flight at the moment of commitment.
- The application is verified working against self-hosted — read, write, authenticate, and file access — before the window is declared closed.
- Aviation AI Pro's five applications and `sos` are provably untouched.
- A rehearsal-then-commit structure, so that everything up to the subscription drop can be abandoned at no cost.

**Non-Goals:**
- **Zero-downtime or canary cutover.** Explicitly rejected: the clients cannot address two backends simultaneously, and a partial state is harder to reason about and to abort than a short window.
- **Introducing the `window.__ENV__` runtime-config writer** to make cutover a config flip. It is the better long-term design and it is deliberately out of scope — it is an application code change with its own testing needs, and adding it immediately before a cutover trades a known-slow rollback for an untested new mechanism.
- **Decommissioning the Supabase Cloud project.** It stays running and paid-for after cutover, as the rollback substrate and as a data source for reconciliation. Retiring it is a later, separate decision.
- **Reverse replication** (self-hosted → production) as a rollback aid. Considered; rejected as more machinery than the risk warrants for a short window, and it would need its own correctness proof.
- Fixing email deliverability (spam placement), the `functions`-router ES256 gap, or the deploy-branch structural drift. All tracked separately; none blocks cutover.

## 3. Approach

Two stages: **rehearsal** (steps 1–3, abandonable at any point, no user impact) and **commitment** (steps 4 onward).

**Rehearsal — before the window, and again at its start:**
1. **Re-derive the container inventory from resolved values**, exactly as §1a.1 describes — never from this document's table, and never from an env-key search. Confirm the count and that no `avaipro-*` or `sos` container is in it.
2. **Resolve the orphaned containers** (§1b Finding A): establish whether `amro-api` and `amro-api-container` serve live traffic or are dead weight, then either stop them or add them to the repoint set. Do this in rehearsal, not in the window — it needs investigation, not a decision under time pressure.
3. **Verify parity and health:** all seven self-hosted containers healthy; the four standard production health curls returning 200; replication lag at zero; auth row counts matching (103/101/104); a sample of application tables comparing row counts across both databases.
4. **Capture the full rollback baseline:** every one of the 10 containers' current Supabase-related env values, the frontend's current image tag/build args, and production's complete sequence inventory. Paste it into the execution record — a rollback plan that lives only in a temp file is not a rollback plan.

**Commitment — inside the window:**
4. **Quiesce writes.** Stop the nine backend services so production stops receiving application writes. The frontend may remain up serving a maintenance state, or be stopped; either way users are not transacting.
5. **Drain and confirm.** Wait for replication lag to reach zero and stay there, proving every accepted write has landed on self-hosted.
6. **Drop the subscription** (`phase2_public_migration_sub`) on self-hosted, and drop the corresponding publication/slot on production so no slot is left retaining WAL. **This is the point of no return** — record the wall-clock time, as it bounds any later reconciliation.
7. **Re-run the storage sync** (§1b Finding B) so any object uploaded to production since the last run is copied across, and fold in the README's existing `owner`/`owner_id` check rather than tracking it separately.
8. **Sync all sequences.** For every sequence in the 21 application schemas, set self-hosted's value to production's current value (with a safety margin). Read production's values *now*, not from §1a's table.
9. **Repoint the runtime services** (env update + restart), then **rebuild and redeploy `frontend`** with the new `VITE_SUPABASE_URL`/keys.
10. **Verify** (see §4) before declaring the window closed.

**After the window:** monitor, and leave production untouched and running as the rollback substrate.

## 4. Verification Plan

Verification must exercise the application, not just assert configuration. Cutover failures show up as writes going to the wrong place or as sequence collisions, neither of which a config read would reveal.

1. **Configuration, from resolved values:** each of the 10 containers reports the self-hosted URL in its actual running environment. Separately confirm the 5 `avaipro-*` containers and `sos` are unchanged, by comparing their resolved values against the step-3 baseline.
2. **Replication genuinely stopped:** no subscription on self-hosted, and **no replication slot left on production** — a forgotten slot silently retains WAL and has already caused two incidents in this project's history.
3. **Sequences correct:** for every sequence in all 21 schemas, self-hosted's value is `>=` production's captured value. This is the check that prevents the primary-key collision described in §1a.3.
4. **A real write succeeds and lands in the right place — the single indispensable check (§1b Finding C).** Connection-level inspection of production cannot detect a service still pointed at Cloud, because the VPS reaches it through the pooler and PostgREST rather than as a direct client. Run this **per repointed service**, not once globally: perform an application-level write through the running app, then confirm the row exists in **self-hosted** and does **not** appear in production. This is the definitive proof of cutover, and the only check that catches a service silently still pointed at Cloud.
5. **A real login succeeds** against self-hosted, using a genuine migrated user account, confirming end-to-end auth against the new stack.
6. **Storage and edge functions respond** for an authenticated user, exercising the two subsystems whose JWT handling §1a.5 argues is fine post-cutover — the argument should be confirmed, not assumed.
7. **The four standard production health curls** return 200 throughout, and Aviation AI Pro's endpoint specifically is checked, since it shares the VPS.

## 5. Rollback

Rollback has two regimes, and the difference between them is the whole reason for the rehearsal/commitment split.

**Before step 6 (subscription drop):** free. Nothing has changed except stopped services. Restart them; replication has continued throughout; abandon the window and reschedule.

**After step 6:** no longer a configuration reversal. Restoring the ten services to production is mechanically straightforward — the step-3 baseline holds every value, and the frontend rebuild is the slow part (minutes) — but any write self-hosted accepted after step 6 exists **only** on self-hosted, and reverting abandons it. Recovering those writes means identifying and replaying them into production, which is bespoke work proportional to how long the window ran.

Two consequences worth stating plainly:
- **The decision to roll back should be made early or not at all.** The cost grows with elapsed time and accepted writes.
- **Verification (§4) should complete before real users are readmitted**, so that failure is caught while the write volume is still effectively zero and rollback is still nearly free.

Production remains running and unmodified throughout, which is what makes any of this recoverable; §2 keeps its decommissioning explicitly out of scope for exactly that reason.

## 6. Open Questions

- **Window timing and duration** are not yet chosen. The dominant cost is the `frontend` image rebuild (`npm ci` plus a Vite production build), which should be measured during rehearsal rather than estimated.
- **Whether to pre-build the frontend image** before the window, so step 8 is a redeploy of an already-built artefact rather than a build. This would materially shorten the commitment period and is worth deciding in the plan.
- **How users are told.** Everyone is logged out and must sign in again; password-reset mail currently lands in spam. Whether that warrants advance notice is a product decision, not a technical one.

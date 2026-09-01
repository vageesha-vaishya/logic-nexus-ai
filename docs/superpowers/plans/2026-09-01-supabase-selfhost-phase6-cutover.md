# Phase 6: Production Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans for Tasks 1 and 2. **Task 3 is a runbook, not a dispatchable task — see the warning on it.** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move live traffic from Supabase Cloud to the self-hosted stack, in one announced window, with a rehearsal that de-risks it and a defined point past which rollback stops being free.

**Architecture:** Three tasks in escalating commitment. Task 1 is read-only reconnaissance that resolves the unknowns the audit surfaced — nothing changes. Task 2 pre-stages the slow and error-prone parts *outside* the window, so the window itself contains as little work as possible. Task 3 is the window: executed as one continuous operation with a human present, never dispatched to run unattended.

**Tech Stack:** SSH, `docker`/`docker compose`, `psql`, Coolify's env-var API, the Supabase Management API. No application code changes.

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-09-01-supabase-selfhost-phase6-cutover-design.md`. **Read §1b first** — its audit found the inventory in §1a was wrong and that two orphaned containers exist; §1a's "10 containers" figure is superseded.
- SSH alias `hostinger-vps`. Self-hosted stack UUID `i64jlyerora7ao9vkw5sweh3`. Production project ref `gzhxgoigflftharcmdqj`. Tokens in the repo-root gitignored `env`.
- **Never touch the `avaipro-*` containers or `sos`.** They belong to different Supabase projects that share this VPS. An env-key search will falsely include them; the inventory must come from *resolved values* on running containers.
- **Target values for repointing** (verified during planning):
  - `SUPABASE_URL` → `https://supabase.sosservices.online`
  - `DATABASE_URL` / `SUPABASE_DB_URL` → `postgresql://postgres:<POSTGRES_PASSWORD>@db:5432/postgres` — the alias `db` is stable across container recreates, is claimed by **only** the self-hosted database on the `coolify` network (collision-checked), and all backend services are on that network. Password is `POSTGRES_PASSWORD` in the VPS `.env`.
  - `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` → self-hosted's own values from the VPS `.env`, **not** production's.
- Self-hosted DB container at time of writing: `db-i64jlyerora7ao9vkw5sweh3-054239087325`. Frontend Coolify app: `b2lt2if6x6ovekc4tj7vg8tx`. Replication subscription: `phase2_public_migration_sub`. **Re-verify all of these live** — container names change on recreate.
- Never print a real secret. Report lengths or match/mismatch verdicts.
- After any container-affecting step, run the four standard health curls:
  ```bash
  ssh hostinger-vps "curl -s -o /dev/null -w 'app: %{http_code}\n' https://app.sosservices.online/; curl -s -o /dev/null -w 'api: %{http_code}\n' https://api.sosservices.online/health; curl -s -o /dev/null -w 'amro: %{http_code}\n' https://amro.sosservices.online/health; curl -s -o /dev/null -w 'aviation: %{http_code}\n' https://app.aviation.sosservices.online/"
  ```
  The `aviation` one is not incidental — it is the canary proving the co-tenant system is unharmed.

---

### Task 1: Rehearsal — build the true inventory and resolve the unknowns

**Files:** none. Entirely read-only reconnaissance plus one written artefact (the report).

**Interfaces:**
- Consumes: nothing — first task.
- Produces: the authoritative container inventory, a decision on the two orphans, and a measured frontend build time. Tasks 2 and 3 depend on all three.

- [ ] **Step 1: Build the inventory from resolved values, not from Coolify's app list**

```bash
ssh hostinger-vps "for c in \$(docker ps --format '{{.Names}}'); do
  u=\$(docker inspect \$c --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep -E '^(SUPABASE_URL|VITE_SUPABASE_URL|DATABASE_URL|SUPABASE_DB_URL)=' | head -1)
  case \"\$u\" in *gzhxgoigflftharcmdqj*) echo \"  \$c\";; esac
done"
```
Expected: **eleven** containers (see spec §1b Finding A). Record the exact list — it is the cutover set. Separately confirm no `avaipro-*` or `sos` container appears. If the count differs from eleven, stop and reconcile before continuing: a container that appears or disappears between now and the window is exactly the failure mode this step exists to catch.

- [ ] **Step 2: Resolve the two orphaned containers — the audit's headline finding**

`amro-api` (locally-built image, running since 2026-07-08) and `amro-api-container` (an older Coolify image under a hand-chosen name, since 2026-07-23) both point at production but are **not** managed by the current Coolify deployment, so repointing via Coolify would miss them.

Establish whether either serves live traffic:
```bash
ssh hostinger-vps "docker ps --filter name=amro --format '{{.Names}}\t{{.Status}}\t{{.Ports}}'"
ssh hostinger-vps "docker inspect amro-api amro-api-container --format '{{.Name}} netaliases={{range \$n,\$c := .NetworkSettings.Networks}}{{\$c.Aliases}}{{end}}' 2>&1"
ssh hostinger-vps "docker logs amro-api --since 24h 2>&1 | tail -5; echo '--- amro-api-container ---'; docker logs amro-api-container --since 24h 2>&1 | tail -5"
```
Recent request logs mean it is serving; silence plus no routing alias means it is dead weight. **Decide and record which**, then either stop them (preferred if unused — it shrinks the cutover surface) or add them to the repoint set. Do not defer this into the window.

- [ ] **Step 3: Verify parity between the two databases**

```bash
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-054239087325 psql -U supabase_admin -d postgres -tAc \"SELECT count(*) FROM auth.users; SELECT count(*) FROM auth.identities; SELECT count(*) FROM public.profiles;\""
```
Expected `103` / `101` / `104`. Then compare row counts for a sample of the largest application tables against production (query production via `mcp__claude_ai_Supabase__execute_sql`, project `gzhxgoigflftharcmdqj`). Any material divergence means replication is not healthy and cutover must not proceed.

- [ ] **Step 4: Confirm replication is live and lag is effectively zero**

```bash
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-054239087325 psql -U supabase_admin -d postgres -tAc \"SELECT subname, subenabled FROM pg_subscription;\""
```
Expected: `phase2_public_migration_sub|t`. Then on production, confirm the slot is active with minimal retained WAL:
```
mcp__claude_ai_Supabase__execute_sql (gzhxgoigflftharcmdqj):
SELECT slot_name, active, wal_status, pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained FROM pg_replication_slots;
```
Expected: `phase2_public_migration_slot`, `active=true`, `wal_status=reserved`, retained WAL small (kB, not GB).

- [ ] **Step 5: Capture the complete rollback baseline**

For each of the eleven containers, record its current `SUPABASE_URL`/`DATABASE_URL`/`SUPABASE_DB_URL`/key values (redact secrets to lengths). Record the frontend's current image tag. Capture production's full sequence inventory across all schemas:
```
mcp__claude_ai_Supabase__execute_sql (gzhxgoigflftharcmdqj):
SELECT schemaname||'.'||sequencename AS seq, last_value FROM pg_sequences WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY 1;
```
**Paste all of it into the task report.** A baseline that lives only in a temp file is not a baseline.

- [ ] **Step 6: Measure the frontend build time — WITHOUT deploying anything**

⚠ **Do not trigger a Coolify rebuild of `frontend` to time it.** Per spec §1c, the running container was built from `7d5d04db` while Coolify deploys `main` at `HEAD`, which is now 138 commits ahead including 52 application files. A rebuild would ship that entire pending release to production. An earlier draft of this step wrongly called it a no-op; it is not.

Instead, time a build **on the VPS that produces no deployment**, from the pinned commit:
```bash
ssh hostinger-vps "cd /tmp && rm -rf _p6build && git clone --quiet --no-checkout https://github.com/vageesha-vaishya/logic-nexus-ai.git _p6build 2>/dev/null || echo 'CLONE FAILED - use an existing checkout or skip'; cd _p6build 2>/dev/null && git checkout --quiet 7d5d04db 2>&1 | tail -2"
```
If the clone needs credentials the VPS lacks, say so and fall back to timing the build inside an existing source directory on the VPS, or report that the measurement could not be taken rather than inventing a number. Then:
```bash
ssh hostinger-vps "cd /tmp/_p6build && time docker build --build-arg VITE_SUPABASE_URL=https://supabase.sosservices.online -t phase6-timing-probe:local . 2>&1 | tail -5"
ssh hostinger-vps "docker rmi phase6-timing-probe:local 2>/dev/null; rm -rf /tmp/_p6build"
```
Record the wall-clock. This sizes the window and feeds Task 2 Step 4's pre-build decision. **Clean up the image and the checkout** — leaving a stray image on a VPS with 24 other production apps is not acceptable.

- [ ] **Step 7: Run the four health curls and write the report**

Expected: all `200`, `aviation` included. Nothing in this task changed anything; the curls confirm that.

---

### Task 2: Pre-stage everything that can be done outside the window

**Files:**
- Create: `deploy/selfhosted-supabase/scripts/phase6-sync-sequences.sh`

**Interfaces:**
- Consumes: Task 1's inventory, orphan decision, and build-time measurement.
- Produces: a tested sequence-sync script and (optionally) a pre-built frontend image. Task 3 executes both.

- [ ] **Step 1: Write the sequence-sync script**

It must: read every sequence in the non-system schemas from **production** at run time (never from a stored list), and for each, `setval` the matching sequence on self-hosted to production's value plus a safety margin. It must be idempotent, skip sequences absent on either side while reporting them, and print a per-sequence before/after line.

Key correctness points: use `pg_sequences` (not a hardcoded list — spec §1a.3 covers 28 sequences and the count can change); handle `last_value IS NULL` on the production side (never advanced there either — `setval` with a NULL source should be skipped, not coerced to 0); and never lower a self-hosted sequence, only raise it.

- [ ] **Step 2: Dry-run the script and prove it is correct without applying it**

Run in a report-only mode against live production and self-hosted. Confirm it enumerates all sequences, correctly identifies the ones needing advancement, and would set values `>=` production's. Quote the full output in the report.

- [ ] **Step 3: Verify the script's effect is real, on a scratch sequence**

Create a throwaway sequence on self-hosted, run the sync logic against it with a known target, confirm it advances, then drop it. This proves the `setval` path works rather than assuming it — the script's whole purpose is preventing primary-key collisions, so its mechanism deserves a positive test.

- [ ] **Step 4: Decide and, if chosen, pre-build the frontend image**

Using Task 1 Step 6's measured build time, decide whether to pre-build the frontend image before the window so Task 3 contains a redeploy rather than a build.

**Regardless of that decision, the build must be pinned to branch `deploy/phase6-cutover` @ `befd7052`** — **not** to bare commit `7d5d04db`. That commit alone still carries the Dockerfile that no longer builds (`redis-memory-server`'s postinstall falls back to compiling Redis and dies on missing `pkg-config`); the one-line fix exists only on the cutover branch. Pinning to the bare SHA would reintroduce a build failure inside the window. The branch is `7d5d04db` + that single fix, so it still ships none of the 138 pending commits (spec §1c). Verify the pinning mechanism now, not in the window: confirm that setting Coolify's `git_branch` and `git_commit_sha` on app `b2lt2if6x6ovekc4tj7vg8tx` to `deploy/phase6-cutover` / `befd7052` — **without** an `instant_deploy` field — pins the build without triggering a deploy, and record how to restore both fields afterwards. If Coolify cannot pin reliably, report that — building the image manually and deploying it is the fallback, and it changes Task 3 Step 7.

Recommended if the build exceeds a few minutes. The tradeoff to state explicitly in the report: pre-building shortens the commitment period, but the pre-built image points at self-hosted and **must not be deployed early** — guard against an accidental deploy between staging and the window.

- [ ] **Step 5: Commit the script**

```bash
git add deploy/selfhosted-supabase/scripts/phase6-sync-sequences.sh
git commit -m "feat(phase6): add sequence-sync script for cutover"
```

---

### Task 3: The cutover window — RUNBOOK, not a dispatchable task

> **⚠ Do not dispatch this to an autonomous subagent.** It is a continuous operation with a point of no return, it requires judgement calls if a step misbehaves, and abandoning it half-executed leaves the system in a state no other step anticipates. Execute it with the plan owner present, one step at a time, confirming each before the next. The controller should run it directly, or the operator should follow it by hand.

**Preconditions — all must hold before starting:** Tasks 1 and 2 complete; the orphan decision made and applied; a window agreed with the plan owner; the sequence script tested.

- [ ] **Step 1: Re-run Task 1's inventory and parity checks**

State drifts. Re-confirm the container set, replication health, and row counts immediately before starting. Abort if anything differs from Task 1 without explanation.

- [ ] **Step 2: Quiesce writes**

Stop the backend services (the inventory minus `frontend`), so production stops receiving application writes. Record the stop time.

- [ ] **Step 3: Drain replication to zero and confirm**

Watch retained WAL / lag until it reaches zero and holds. This proves every accepted write has landed on self-hosted. Do not proceed on a single zero reading — confirm it is stable.

- [ ] **Step 4: Re-run the storage sync** (spec §1b Finding B)

Copy any object uploaded to production since the last run, and re-run the README's `owner`/`owner_id` check. Expect little or nothing to copy — production's newest object predates this by months — but the step is required because that is an assumption about the past, not a guarantee about the present.

- [ ] **Step 5: ⚠ POINT OF NO RETURN — drop the subscription**

```bash
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-054239087325 psql -U supabase_admin -d postgres -c \"DROP SUBSCRIPTION phase2_public_migration_sub;\""
```
Then confirm on production that **no replication slot remains** — a forgotten slot silently retains WAL and has already caused two incidents in this project's history. **Record the wall-clock time**; it bounds any later reconciliation.

From here, rollback is no longer free. Everything before this step could have been abandoned at no cost.

- [ ] **Step 6: Sync all sequences**

Run Task 2's script for real. Confirm every sequence on self-hosted is now `>=` production's captured value. This must happen **after** the drop and **before** any write is accepted.

- [ ] **Step 7: Repoint the services and bring them back**

Update each service's `SUPABASE_URL`, `DATABASE_URL`/`SUPABASE_DB_URL`, and keys to the self-hosted targets in Global Constraints (Coolify env store **and**, for anything using the flat file, the on-disk `.env`), then start them. Deploy the frontend — a redeploy of the pre-built image if Task 2 Step 4 chose that, otherwise a rebuild **pinned to branch `deploy/phase6-cutover` @ `befd7052`** using the mechanism Task 2 verified — set Coolify's `git_branch`/`git_commit_sha` on app `b2lt2if6x6ovekc4tj7vg8tx` **without** an `instant_deploy` field, which Task 2 confirmed updates the pin without triggering a deploy. Never pin to bare `7d5d04db`: that commit's Dockerfile no longer builds. Confirm before deploying that the build is pinned; an unpinned rebuild ships 138 commits of application code alongside the cutover and destroys the ability to attribute any failure (spec §1c).

- [ ] **Step 8: Verify — do not reopen until these pass**

1. Every repointed container's **resolved** environment shows the self-hosted target.
2. The `avaipro-*` containers and `sos` are unchanged versus the Task 1 baseline.
3. Every sequence is `>=` production's captured value.
4. **A real application write lands on self-hosted and does NOT appear on production** — per spec §1b Finding C this is the *only* reliable proof, because connection-level checks cannot see a stale service. Run it **per repointed service**, not once.
5. A real login succeeds with a migrated user account.
6. Storage and an edge function respond for an authenticated user.
7. All four health curls `200`, `aviation` included.

- [ ] **Step 9: Reopen, then monitor**

Only after Step 8 passes in full. Watch error rates and the health curls. Leave production running and untouched as the rollback substrate — do not decommission it.

---

## Rollback

- **Before Task 3 Step 5:** free. Restart the stopped services; replication has continued throughout; reschedule.
- **After Step 5:** restoring the services to production is mechanical (Task 1 Step 5's baseline holds every value; the frontend is the slow part), but any write self-hosted accepted post-drop exists only there and is abandoned by reverting. Recovering it is bespoke reconciliation proportional to elapsed time.
- **Therefore:** decide early or not at all, and complete Step 8's verification *before* readmitting users, so failure is caught while write volume is still effectively zero.

## Plan Self-Review

**Spec coverage:** §1b Finding A (wrong inventory, two orphans) → Task 1 Steps 1-2, and the Global Constraints warning against env-key searches. Finding B (storage re-sync) → Task 3 Step 4. Finding C (connection checks can't verify) → Task 3 Step 8.4, stated as the only reliable proof and required per-service. §1a.3 (sequences) → Task 2 in full and Task 3 Step 6. §1a.4 (commitment point) → the Task 3 Step 5 warning and the rehearsal/commitment split across tasks. §3's ordering is preserved. §5's two rollback regimes are reproduced. §6's open questions are converted into decisions with owners: window timing is a Task 3 precondition, pre-building is Task 2 Step 4, user comms remains the plan owner's call and is deliberately not assigned to an implementer.

**Placeholder scan:** No TBD/TODO. Task 2 Step 1 specifies the script's required behaviour and correctness properties rather than its source, deliberately — the enumeration must be dynamic, and pinning literal SQL here would invite the hardcoded-list bug the step exists to avoid. Steps 2-3 verify the result, so the requirement is testable rather than aspirational. Task 3 Step 7's per-service values come from the Global Constraints table rather than being restated eleven times.

**Type/name consistency:** The subscription name, DB container, frontend app UUID, project ref, and the `db:5432` target appear identically wherever referenced, each with a live re-verification instruction attached since container names change on recreate. The eleven-container figure is stated once (Task 1 Step 1) and referenced thereafter rather than re-derived.

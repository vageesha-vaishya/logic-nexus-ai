# Auth Email / SMTP Configuration Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make auth email genuinely work on both stacks — real SMTP delivery via Resend, uncorrupted email link paths, and a redirect base URL that points at the application rather than at the API gateway (self-hosted) or `localhost:3000` (production).

**Architecture:** Task 1 fixes the self-hosted stack (env-var only) and proves the whole configuration end-to-end on a stack with no external users. Task 2 applies the equivalent fix to production only after Task 1 has demonstrated it works. That ordering is deliberate: production is the stack with live users, and Task 2's changes are the ones that can regress something currently functioning.

**Tech Stack:** Coolify env-var API and the Supabase Management API (both driven from `python3`/`urllib`, never shell arguments — see Global Constraints), Resend's API for verification, SSH, `docker compose`. No compose-file change, no code change.

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-09-01-auth-email-smtp-config-design.md`. Read **§1a** in particular — its three audit findings changed the design, and one of them (the localhost allow-list) prevents a regression this plan would otherwise cause on production.
- SSH alias `hostinger-vps`. Coolify UUID `i64jlyerora7ao9vkw5sweh3`. Production Supabase project ref `gzhxgoigflftharcmdqj`. Tokens live in the repo-root gitignored `env` file (`COOLIFY_API_TOKEN`, `SUPABASE_ACCESS_TOKEN`, `RESEND_API_KEY`).
- Live container names as of writing: `auth-i64jlyerora7ao9vkw5sweh3-054239010699`, `rest-…-054239032577`, `db-…-054239087325`, `kong-…-054238985058`, `storage-…-054239043652`, `realtime-…-054239058529`, `functions-…-054239069112`. **Re-verify live** — a recreate changes the trailing ID.
- **Never pass a value beginning with `/` as a shell argument on this Windows/Git-Bash host.** The corruption being repaired (`/auth/v1/verify` → `C:/Users/Vimal/AppData/Local/Programs/Git/auth/v1/verify`) is MSYS2 path conversion, and it will happen again to anyone who forgets. Drive every API call from `python3` with `urllib`, building request bodies as Python dicts — no `curl -d`, no leading-slash values in `ssh`/`sed` arguments. Verify the resulting values byte-for-byte afterwards rather than trusting they went through intact.
- **Never print a real secret value** in any report: not `RESEND_API_KEY` (which is also `SMTP_PASS`), not `COOLIFY_API_TOKEN`, not `SUPABASE_ACCESS_TOKEN`, not `JWT_SECRET`. Email *link* contents are not secret and must be quoted, since verifying them is the point — but a password-reset link contains a single-use token, so quote the host and path and redact the token value itself.
- All 12 self-hosted target keys already exist in Coolify's store with two entries each (production + `is_preview`), so every self-hosted change is a **PATCH** on both copies. Confirmed during planning.
- After any container-affecting step, run the four standard production health-check curls:
  ```bash
  ssh hostinger-vps "curl -s -o /dev/null -w 'app: %{http_code}\n' https://app.sosservices.online/; curl -s -o /dev/null -w 'api: %{http_code}\n' https://api.sosservices.online/health; curl -s -o /dev/null -w 'amro: %{http_code}\n' https://amro.sosservices.online/health; curl -s -o /dev/null -w 'aviation: %{http_code}\n' https://app.aviation.sosservices.online/"
  ```
- Kong's `key-auth` gates `/auth/v1/*`, so calls to self-hosted through the public domain need an `apikey` header carrying **self-hosted's own** `ANON_KEY` (from the VPS `.env`), never production's.
- Verification uses the **Resend API** to read what was actually sent (`GET https://api.resend.com/emails` to find the message, `GET /emails/{id}` for `html`/`text`/`last_event`). Do not settle for "the user says it arrived"; assert on the delivered body. **Fetch it with `curl`, not python `urllib`** — Resend sits behind Cloudflare, which rejects urllib's user-agent with `HTTP 403 error code: 1010`. This bit the first run of Task 1; python is fine for *parsing* the downloaded JSON. Relatedly, python on this Windows host cannot write to `/tmp` — use `$TEMP`.

**Target values** (identical across both stacks except where noted):

| Setting | Value |
|---|---|
| SMTP host / port | `smtp.resend.com` / `465` (implicit TLS via gomail's `SSL: port == 465`) |
| SMTP user / pass | `resend` / the existing `RESEND_API_KEY` |
| Sender address | `noreply@sosservices.online` (verified Resend domain; already in active use) |
| Sender name | `Logic Nexus AI` (self-hosted already correct — do not touch) |
| `SITE_URL` / `site_url` | `https://app.sosservices.online` |
| Mailer URL paths (self-hosted only) | `/auth/v1/verify` ×4 |
| Allow-list — self-hosted | **leave empty** (§1a Finding 1: `SITE_URL` same-origin already covers it) |
| Allow-list — production | `http://localhost:8081/**,http://localhost:4173/**` (§1a Finding 2) |
| `rate_limit_email_sent` (production only) | `2` → `30` |

---

### Task 1: Fix and verify the self-hosted stack

**Files:** none in this repo — Coolify env store, the VPS `.env`, and live containers only.

**Interfaces:**
- Consumes: nothing from an earlier task — first task.
- Produces: a working, proven-correct email configuration whose exact values Task 2 reuses on production.

- [ ] **Step 1: Capture the baseline**

Record, verbatim, for rollback and for the post-change diff:
```bash
ssh hostinger-vps "docker ps --filter name=i64jlyerora7ao9vkw5sweh3 --format '{{.Names}}\t{{.CreatedAt}}'"
ssh hostinger-vps "docker inspect auth-i64jlyerora7ao9vkw5sweh3-054239010699 --format '{{range .Config.Env}}{{println .}}{{end}}'" | grep -E "^(SMTP_|MAILER_URLPATHS_|SITE_URL=|ADDITIONAL_REDIRECT_URLS=|GOTRUE_SMTP_|GOTRUE_MAILER_URLPATHS_|GOTRUE_SITE_URL=|GOTRUE_URI_ALLOW_LIST=)" | sort
```
Expected: `SMTP_HOST/USER/PASS` are `REPLACE_WITH_*`, the four `MAILER_URLPATHS_*` carry the `C:/Users/Vimal/...` prefix, `SITE_URL=https://supabase.sosservices.online`. Note every container's `CreatedAt` — Step 5 diffs against it.

- [ ] **Step 2: PATCH the 10 changed values into Coolify's env store (both copies each)**

`SMTP_SENDER_NAME` is already correct and `ADDITIONAL_REDIRECT_URLS` stays empty, so 10 keys change, not 12. Drive it from Python so no leading-slash value ever touches a shell argument:

```bash
cd H:/Projects/logic-nexus-ai
python3 - <<'PY'
import json, re, urllib.request
def env(k):
    for line in open('env', encoding='utf-8'):
        m = re.match(rf'^{k}="?(.*?)"?$', line.rstrip('\n'))
        if m: return m.group(1)
    raise SystemExit(f'{k} not found in env')

token, resend_key = env('COOLIFY_API_TOKEN'), env('RESEND_API_KEY')
url = "http://72.61.249.111:8000/api/v1/applications/i64jlyerora7ao9vkw5sweh3/envs"
targets = {
    "SMTP_HOST": "smtp.resend.com",
    "SMTP_PORT": "465",
    "SMTP_USER": "resend",
    "SMTP_PASS": resend_key,
    "SMTP_ADMIN_EMAIL": "noreply@sosservices.online",
    "SITE_URL": "https://app.sosservices.online",
    "MAILER_URLPATHS_CONFIRMATION": "/auth/v1/verify",
    "MAILER_URLPATHS_RECOVERY": "/auth/v1/verify",
    "MAILER_URLPATHS_INVITE": "/auth/v1/verify",
    "MAILER_URLPATHS_EMAIL_CHANGE": "/auth/v1/verify",
}
for key, value in targets.items():
    for preview in (False, True):
        body = {"key": key, "value": value}
        if preview: body["is_preview"] = True
        req = urllib.request.Request(url, method="PATCH", data=json.dumps(body).encode(),
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
        r = json.load(urllib.request.urlopen(req))
        print(f"{key:32} preview={preview!s:5} uuid={r.get('uuid')}")
PY
```
Expected: 20 lines, each with a `uuid`. Re-`GET` the endpoint afterwards and confirm each of the 10 keys still has **exactly 2** entries — a third would mean an accidental create.

- [ ] **Step 3: Update the on-disk `.env` on the VPS**

The manual `docker compose` in Step 4 reads this file, not Coolify's store; both must agree (per the README's dual-source rule). The updater runs **on the VPS** and reads the secret from a file rather than argv, so no leading-slash or secret value is ever a shell argument:

```bash
cd H:/Projects/logic-nexus-ai
# 1. Stage the Resend key and the updater script (key never appears on a command line).
python3 -c "import re;print(next(re.match(r'^RESEND_API_KEY=\"?(.*?)\"?$',l.rstrip()).group(1) for l in open('env',encoding='utf-8') if l.startswith('RESEND_API_KEY')),end='')" > _rk.tmp
cat > _envfix.py <<'PY'
import io, os, re
ENVP = '/data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env'
key = open('/tmp/_rk.txt').read().strip()
targets = {
    "SMTP_HOST": "smtp.resend.com",
    "SMTP_PORT": "465",
    "SMTP_USER": "resend",
    "SMTP_PASS": key,
    "SMTP_ADMIN_EMAIL": "noreply@sosservices.online",
    "SITE_URL": "https://app.sosservices.online",
    "MAILER_URLPATHS_CONFIRMATION": "/auth/v1/verify",
    "MAILER_URLPATHS_RECOVERY": "/auth/v1/verify",
    "MAILER_URLPATHS_INVITE": "/auth/v1/verify",
    "MAILER_URLPATHS_EMAIL_CHANGE": "/auth/v1/verify",
}
lines = open(ENVP, encoding='utf-8').read().split('
')
seen = set()
for idx, line in enumerate(lines):
    m = re.match(r'^([A-Z0-9_]+)=', line)
    if m and m.group(1) in targets:
        k = m.group(1); lines[idx] = f'{k}={targets[k]}'; seen.add(k)
for k, v in targets.items():
    if k not in seen: lines.append(f'{k}={v}')
while lines and lines[-1] == '': lines.pop()          # normalise trailing blanks
open(ENVP, 'w', encoding='utf-8').write('
'.join(lines) + '
')  # exactly one trailing newline
print("replaced:", len(seen), "appended:", len(targets) - len(seen))
PY
scp -q _rk.tmp hostinger-vps:/tmp/_rk.txt && scp -q _envfix.py hostinger-vps:/tmp/_envfix.py
rm -f _rk.tmp _envfix.py
# 2. Apply, then destroy the staged key immediately.
ssh hostinger-vps "python3 /tmp/_envfix.py; rm -f /tmp/_rk.txt /tmp/_envfix.py"
```
Expected: `replaced: 10 appended: 0`. Then verify the result:
```bash
ssh hostinger-vps "grep -cE '^(SMTP_HOST|SMTP_PORT|SMTP_USER|SMTP_PASS|SMTP_ADMIN_EMAIL|SITE_URL|MAILER_URLPATHS_CONFIRMATION|MAILER_URLPATHS_RECOVERY|MAILER_URLPATHS_INVITE|MAILER_URLPATHS_EMAIL_CHANGE)=' /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env"
ssh hostinger-vps "grep -c 'C:/Users' /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env || echo 'no mangled paths remain'"
ssh hostinger-vps "tail -c1 /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env | xxd | tail -1"
```
Expected: `10`; `no mangled paths remain`; and a trailing `0a` byte.

- [ ] **Step 4: Recreate `auth` only**

```bash
ssh hostinger-vps "cd /data/coolify/applications/i64jlyerora7ao9vkw5sweh3 && docker compose -p i64jlyerora7ao9vkw5sweh3 --env-file .env -f docker-compose.yaml up -d auth"
sleep 8
ssh hostinger-vps "docker ps --filter name=auth-i64jlyerora7ao9vkw5sweh3 --format '{{.Names}}\t{{.Status}}'"
```
Expected: `Up … (healthy)`. If it crash-loops, capture `docker logs` and roll back per §5 before debugging further.

- [ ] **Step 5: Verify the values landed byte-for-byte, and check the blast radius**

```bash
ssh hostinger-vps "docker inspect \$(docker ps --filter name=auth-i64jlyerora7ao9vkw5sweh3 --format '{{.Names}}') --format '{{range .Config.Env}}{{println .}}{{end}}'" | grep -E "^GOTRUE_(SMTP_(HOST|PORT|USER|ADMIN_EMAIL)|MAILER_URLPATHS_|SITE_URL|URI_ALLOW_LIST)=" | sort
```
Expected exactly: `GOTRUE_MAILER_URLPATHS_*=/auth/v1/verify` for all four (**no `C:/Users` prefix — this is the specific repair, assert it explicitly**), `GOTRUE_SITE_URL=https://app.sosservices.online`, `GOTRUE_SMTP_HOST=smtp.resend.com`, `GOTRUE_SMTP_PORT=465`, `GOTRUE_SMTP_USER=resend`, `GOTRUE_SMTP_ADMIN_EMAIL=noreply@sosservices.online`. Do not print `GOTRUE_SMTP_PASS`; confirm only that its length matches the Resend key's.

Then compare all 7 containers' `CreatedAt` against Step 1: only `auth` may be fresh. Per Phase 5's `env_file`-wide finding, others *can* be swept in — record what actually happened, and confirm `db` was not.

- [ ] **Step 6: Send a real password-reset email through self-hosted**

```bash
ANON=$(ssh hostinger-vps "grep '^ANON_KEY=' /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env | cut -d= -f2-")
ssh hostinger-vps "curl -s -w '\nHTTP:%{http_code}\n' -X POST https://supabase.sosservices.online/auth/v1/recover -H \"apikey: ${ANON}\" -H 'Content-Type: application/json' -d '{\"email\":\"bahuguna.vimal@gmail.com\"}'"
```
Expected: HTTP `200`. Note GoTrue returns `200` whether or not delivery succeeds, so this step proves nothing on its own — Step 7 is the actual verification.

- [ ] **Step 7: Assert on what Resend actually delivered — the real test**

```bash
cd H:/Projects/logic-nexus-ai
# NOTE: Resend's API sits behind Cloudflare, which rejects python-urllib's
# user-agent with HTTP 403 "error code: 1010". Use curl to fetch, python only
# to parse. Also: python on this Windows host cannot write to /tmp - use $TEMP.
RESEND=$(grep -E '^RESEND_API_KEY=' env | sed 's/^RESEND_API_KEY="//;s/"$//')
curl -s -H "Authorization: Bearer $RESEND" "https://api.resend.com/emails" -o "$TEMP/_re.json"
ID=$(python3 -c "import json,os;print(json.load(open(os.environ['TEMP']+'/_re.json'))['data'][0]['id'])")
curl -s -H "Authorization: Bearer $RESEND" "https://api.resend.com/emails/$ID" -o "$TEMP/_re1.json"
python3 -c "
import json,os,re
l=json.load(open(os.environ['TEMP']+'/_re.json'))['data'][0]
d=json.load(open(os.environ['TEMP']+'/_re1.json'))
print('created:  ', l['created_at'])
print('from:     ', d.get('from'))
print('to:       ', d.get('to'))
print('subject:  ', d.get('subject'))
print('DELIVERY: ', d.get('last_event'))
body=(d.get('html') or '')+(d.get('text') or '')
for u in sorted(set(re.findall(r'https?://[^\s\"<>]+', body))):
    print('LINK:', re.sub(r'(token=)[^&\"]+', r'<REDACTED>', u))
"
rm -f "$TEMP/_re.json" "$TEMP/_re1.json"
```
**Pass criteria — all four must hold:**
1. The newest email is addressed to `bahuguna.vimal@gmail.com` from `noreply@sosservices.online` with a password-reset subject (i.e. it is *our* message, not an unrelated Aviation AI Pro alert — check `created_at` is within the last few minutes).
2. `last_event` is `delivered` (not `bounced`/`failed`).
3. The link's host+path is `https://supabase.sosservices.online/auth/v1/verify` — **containing no `C:/Users/` fragment**, which is the corruption this task repairs.
4. Its `redirect_to` parameter is `https://app.sosservices.online/...` — **not** the API domain and **not** `localhost`. This is what proves the `SITE_URL` fix worked; a delivered email with a wrong `redirect_to` is a failure, not a pass.

- [ ] **Step 8: Health curls**

Run the four standard curls (Global Constraints). Expected: all `200`.

---

### Task 2: Apply and verify the same fix on production

**Files:** none in this repo — Supabase Management API only.

**Interfaces:**
- Consumes: Task 1's proven-working configuration values. **Do not start this task until Task 1's Step 7 has passed** — the point of the ordering is that production is the stack with live users.
- Produces: nothing further depends on it — last task.

- [ ] **Step 1: Capture production's full pre-change config as the rollback baseline**

```bash
cd H:/Projects/logic-nexus-ai
python3 - <<'PY'
import json, re, urllib.request
tok = next(re.match(r'^SUPABASE_ACCESS_TOKEN="?(.*?)"?$', l.rstrip()).group(1)
           for l in open('env', encoding='utf-8') if l.startswith('SUPABASE_ACCESS_TOKEN'))
d = json.load(urllib.request.urlopen(urllib.request.Request(
    "https://api.supabase.com/v1/projects/gzhxgoigflftharcmdqj/config/auth",
    headers={"Authorization": f"Bearer {tok}"})))
watch = ['site_url','uri_allow_list','smtp_host','smtp_port','smtp_user','smtp_admin_email',
         'smtp_sender_name','smtp_max_frequency','rate_limit_email_sent',
         'mailer_autoconfirm','disable_signup','external_email_enabled','mailer_secure_email_change_enabled']
open('/tmp/_prod_auth_baseline.json','w').write(json.dumps({k: d.get(k) for k in watch}, indent=2))
for k in watch: print(f"  {k} = {d.get(k)!r}")
PY
```
Expected (re-confirm rather than assume): `site_url='http://localhost:3000'`, `uri_allow_list=''`, all `smtp_*` `None`, `rate_limit_email_sent=2`. **Paste this whole block into the task report** — it is the rollback baseline, and a rollback that depends on a file in `/tmp` is not a rollback.

- [ ] **Step 2: PATCH the 9 changed fields**

```bash
cd H:/Projects/logic-nexus-ai
python3 - <<'PY'
import json, re, urllib.request
def env(k):
    for l in open('env', encoding='utf-8'):
        m = re.match(rf'^{k}="?(.*?)"?$', l.rstrip('\n'))
        if m: return m.group(1)
    raise SystemExit(f'{k} missing')
tok, resend_key = env('SUPABASE_ACCESS_TOKEN'), env('RESEND_API_KEY')
body = {
    "site_url": "https://app.sosservices.online",
    "uri_allow_list": "http://localhost:8081/**,http://localhost:4173/**",
    "smtp_host": "smtp.resend.com",
    "smtp_port": "465",
    "smtp_user": "resend",
    "smtp_pass": resend_key,
    "smtp_admin_email": "noreply@sosservices.online",
    "smtp_sender_name": "Logic Nexus AI",
    "rate_limit_email_sent": 30,
}
req = urllib.request.Request("https://api.supabase.com/v1/projects/gzhxgoigflftharcmdqj/config/auth",
    method="PATCH", data=json.dumps(body).encode(),
    headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
r = json.load(urllib.request.urlopen(req))
print("PATCH accepted; fields returned:", len(r))
PY
```
Note `rate_limit_email_sent` is the one field here that relaxes a safety limit (2 → 30/hour), per spec §1a and §3 step 8 — it is deliberate and approved, not incidental.

- [ ] **Step 3: Re-read and confirm both what changed and what didn't**

Re-run Step 1's reader. Expected: the 9 fields hold their new values, **and** the four Non-Goal fields (`mailer_autoconfirm`, `disable_signup`, `external_email_enabled`, `mailer_secure_email_change_enabled`) are byte-identical to the baseline. A `PATCH` silently resetting an unrelated field is a realistic failure of this API and is exactly what this step exists to catch — diff against the captured baseline, do not eyeball.

- [ ] **Step 4: Send a real password-reset email through production**

```bash
cd H:/Projects/logic-nexus-ai
ANON=$(grep -E '^SUPABASE_ANON_KEY=' env | sed 's/^SUPABASE_ANON_KEY="//;s/"$//')
curl -s -w '\nHTTP:%{http_code}\n' -X POST "https://gzhxgoigflftharcmdqj.supabase.co/auth/v1/recover" -H "apikey: ${ANON}" -H 'Content-Type: application/json' -d '{"email":"bahuguna.vimal@gmail.com"}'
```
Expected: HTTP `200`. (Production's `ANON_KEY` here, not self-hosted's.)

- [ ] **Step 5: Assert on production's delivered email — the real verification**

Re-run Task 1 Step 7's Resend script. **Pass criteria:**
1. Newest email is to `bahuguna.vimal@gmail.com` from `noreply@sosservices.online`, created within the last few minutes — confirming production now sends via Resend rather than Supabase's built-in sender.
2. `last_event` is `delivered`.
3. The link's host is `gzhxgoigflftharcmdqj.supabase.co` (production's own auth domain — production's mailer paths are at defaults and were correctly not touched).
4. `redirect_to` is `https://app.sosservices.online/...` — **not `localhost:3000`**. This is the live user-facing defect being repaired, so it is the single most important assertion in this plan.

- [ ] **Step 6: Confirm the localhost allow-list actually works**

The §1a Finding 2 change exists to keep local development working. Verify GoTrue accepts a localhost redirect rather than silently substituting `site_url`:
```bash
cd H:/Projects/logic-nexus-ai
ANON=$(grep -E '^SUPABASE_ANON_KEY=' env | sed 's/^SUPABASE_ANON_KEY="//;s/"$//')
curl -s -o /dev/null -w 'HTTP:%{http_code}\n' -X POST "https://gzhxgoigflftharcmdqj.supabase.co/auth/v1/recover" -H "apikey: ${ANON}" -H 'Content-Type: application/json' -d '{"email":"bahuguna.vimal@gmail.com","options":{"redirectTo":"http://localhost:8081/auth"}}'
```
Then re-read the newest Resend email and confirm its `redirect_to` is `http://localhost:8081/auth` — **not** rewritten to `https://app.sosservices.online`. A substitution here means the allow-list glob didn't match and local dev is still broken. (This sends a second real email; it is worth it, since this is the assertion that the audit's headline finding was actually addressed.)

- [ ] **Step 7: Health curls, and confirm no user data moved**

Run the four standard curls (all `200`), then:
```bash
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-054239087325 psql -U supabase_admin -d postgres -tAc \"SELECT count(*) FROM auth.users; SELECT count(*) FROM auth.identities; SELECT count(*) FROM public.profiles;\""
```
Expected: `103` / `101` / `104` — this phase changes configuration only.

- [ ] **Step 8: Document and commit**

Add a section to `deploy/selfhosted-supabase/README.md` covering: both stacks now send via Resend from `noreply@sosservices.online`; the `MAILER_URLPATHS_*` corruption, its MSYS2 cause, and the never-pass-a-leading-slash-as-a-shell-argument rule that prevents recurrence; that `SITE_URL` must be the *app* domain and why (GoTrue's same-origin redirect rule); that production's allow-list carries localhost so local development against it keeps working; and that production's email rate limit was raised 2 → 30/hour. Also update the **Open items before cutover** section — this closes the SMTP blocker — and the **Phase 6 cutover checklist** if any residual check belongs there.

```bash
git add deploy/selfhosted-supabase/README.md
git commit -m "docs(auth-email): document SMTP/email configuration repair on both stacks"
```

---

## Rollback

- **Self-hosted (Task 1):** PATCH the Step 1 baseline values back (the `REPLACE_WITH_*` placeholders and the old `SITE_URL`), update the VPS `.env` the same way, recreate `auth`. This restores a state where email does not work — which is the status quo, so nothing currently functioning is lost.
- **Production (Task 2):** PATCH the Step 1 baseline back. Two caveats, both worth stating before anyone reaches for this: reverting `site_url` restores a **broken** state (reset links to `localhost:3000`), so it should be reserved for a genuine regression rather than applied reflexively; and reverting SMTP also restores the 2/hour limit, so those two revert together or not at all.
- Neither task touches user rows, tokens, JWT/JWKS configuration, or the replication subscription, so there is nothing to restore in those areas.

## Plan Self-Review

**Spec coverage:** §2 Goals map to Task 1 Steps 2/5 (self-hosted SMTP + paths + `SITE_URL`), Step 7 (real delivery with a correct link), and Task 2 Steps 2/3/5 (production config, no collateral change, real delivery) and Step 6 (localhost allow-list actually functioning). §3's revised steps — including the audit's corrections, empty self-hosted allow-list and localhost-only production allow-list — are carried through literally in the target-values table. §4's eight verification points appear as Task 1 Steps 5/7/8 and Task 2 Steps 3/5/6/7. §5 Rollback is reproduced with its asymmetry caveats intact.

**Placeholder scan:** No TBD/TODO, and every step is directly executable. An earlier draft of Task 1 Step 3 shipped a broken half-written fragment in place of the `.env` updater; it has been replaced with the complete script, which stages the secret and the updater as files, runs the rewrite on the VPS, and destroys the staged key in the same invocation — so neither the secret nor any leading-slash value is ever a shell argument. Its three follow-up commands assert the outcome (10 keys present, no `C:/Users` fragment left, exactly one trailing newline) rather than assuming the rewrite worked.

**Type/name consistency:** The target values in the Global Constraints table are the single source; Tasks 1 and 2 reference them rather than restating divergent literals, except where the two stacks legitimately differ (allow-list contents, mailer paths self-hosted-only, `rate_limit_email_sent` production-only) — each of which is called out as a difference at the point of use. Container names, both project identifiers, and the Resend verification script are identical wherever they recur.

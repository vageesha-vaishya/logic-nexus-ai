# Phase 5b: JWKS-Based Verification of Production Tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make self-hosted's `auth` and `rest` accept production's real ES256-signed access tokens, while leaving self-hosted's own HS256 token issuance — and its existing `ANON_KEY`/`SERVICE_ROLE_KEY` — completely untouched.

**Architecture:** Task 1 builds and offline-validates the two JSON config values, touching no live infrastructure. Task 2 registers them, recreates `auth`/`rest`, and verifies. The split exists so the riskiest input (a malformed `GOTRUE_JWT_KEYS`, which crash-loops GoTrue) is fully validated before it can reach a running container.

**Tech Stack:** `curl`, `python3` (stdlib `json`/`base64` only — no crypto libraries needed), Coolify's env-var API, SSH, `docker compose`. No compose-file change, no code change.

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-08-31-supabase-selfhost-phase5b-jwks-verification-design.md` — read it first, especially **§1a**, whose four audit findings (including one the audit self-corrected) are what this plan implements. Do not implement §3's pre-audit reasoning; §3 has been rewritten to match §1a.
- SSH alias `hostinger-vps`. Coolify application UUID `i64jlyerora7ao9vkw5sweh3`. Coolify API base `http://72.61.249.111:8000`, token in the repo-root gitignored `env` file as `COOLIFY_API_TOKEN`.
- Live container names as of this plan's writing: `auth-i64jlyerora7ao9vkw5sweh3-054239010699`, `rest-i64jlyerora7ao9vkw5sweh3-054239032577`, `db-i64jlyerora7ao9vkw5sweh3-054239087325`, `kong-i64jlyerora7ao9vkw5sweh3-054238985058`, `storage-i64jlyerora7ao9vkw5sweh3-054239043652`, `realtime-i64jlyerora7ao9vkw5sweh3-054239058529`, `functions-i64jlyerora7ao9vkw5sweh3-054239069112`. **Re-verify live before use** — a recreate changes the trailing ID.
- **`GOTRUE_JWT_KEYS` must never exist as an empty string** (spec §1a Finding 3a). GoTrue's decoder `json.Unmarshal`s the value with no empty guard and envconfig invokes it whenever the var is *set*, so a blank value crash-loops `auth` — the service currently serving 103 real users. It goes straight from absent to its correct final value, and rollback **deletes** it rather than blanking it.
- **No compose-file change and no `deploy/supabase-selfhost-phase1` branch sync** are needed (spec §1a Finding 3, self-corrected). Every service declares `env_file: .env`, so any registered env var reaches every container regardless of that service's `environment:` block — confirmed live against the `auth` container.
- `ANON_KEY` and `SERVICE_ROLE_KEY` are **not** modified by this plan, in either direction. If any step seems to call for regenerating them, that is a misreading — stop and re-read spec §1a Finding 1.
- Never print a real secret value in any report: not `JWT_SECRET`, not the derived `oct` JWK's `k` field, not `COOLIFY_API_TOKEN`, not `ANON_KEY`/`SERVICE_ROLE_KEY`, not any access token's signature. Production's **public** JWKS entries and decoded JWT *claims* are not secret and may be quoted in full.
- After any container-affecting step, run the four standard production health-check curls:
  ```bash
  ssh hostinger-vps "curl -s -o /dev/null -w 'app: %{http_code}\n' https://app.sosservices.online/; curl -s -o /dev/null -w 'api: %{http_code}\n' https://api.sosservices.online/health; curl -s -o /dev/null -w 'amro: %{http_code}\n' https://amro.sosservices.online/health; curl -s -o /dev/null -w 'aviation: %{http_code}\n' https://app.aviation.sosservices.online/"
  ```
- Kong's `key-auth` plugin gates `/auth/v1/*` and `/rest/v1/*` — every call to self-hosted through the public domain needs an `apikey` header carrying **self-hosted's own** `ANON_KEY` (from the VPS `.env`), never production's.

---

### Task 1: Build and offline-validate the two config values

**Files:**
- Modify: `env` (repo root, gitignored) — add `GOTRUE_JWT_KEYS` and `JWT_JWKS`.

**Interfaces:**
- Consumes: nothing from an earlier task — first task.
- Produces: two validated JSON strings stored in the repo-root `env` file under the exact keys `GOTRUE_JWT_KEYS` and `JWT_JWKS`. Task 2 reads them from there by those names.

- [ ] **Step 1: Fetch production's JWKS fresh and record it**

```bash
curl -s "https://gzhxgoigflftharcmdqj.supabase.co/auth/v1/.well-known/jwks.json" | python3 -m json.tool
```
Expected: 2 ES256 EC keys, `key_ops: ["verify"]`, `kid`s `c3dfc32a-6c1a-49b1-8830-4f554903ff30` and `5a9b1446-5e00-4a18-a807-fc54aba5241c` (as of this plan's writing — if the set has changed, use what's actually served and note the change; do not force it to match these).

- [ ] **Step 2: Derive the `oct` signing JWK from the existing `JWT_SECRET`**

The `k` field must be the **unpadded base64url** encoding of the secret's raw ASCII bytes, because GoTrue's legacy fallback verifies with `[]byte(config.JWT.Secret)` — if `k` decodes to anything other than those exact bytes, self-hosted-issued tokens and the fallback path would disagree.

```bash
cd H:/Projects/logic-nexus-ai
python3 - <<'PY'
import base64, json, re
secret = None
for line in open('env', encoding='utf-8'):
    m = re.match(r'^JWT_SECRET="(.*)"$', line.rstrip('\n'))
    if m:
        secret = m.group(1)
assert secret, "JWT_SECRET not found in env"
k = base64.urlsafe_b64encode(secret.encode('ascii')).decode('ascii').rstrip('=')
oct_sign = {"kty":"oct","k":k,"kid":"selfhosted-legacy-hs256","alg":"HS256","use":"sig","key_ops":["sign"]}
open('/tmp/_oct_sign.json','w').write(json.dumps(oct_sign))
print("derived oct JWK; k length:", len(k), "(value not printed)")
PY
```
Note the `kid` `selfhosted-legacy-hs256` is arbitrary but must not collide with either production `kid`. Do not print `k`.

- [ ] **Step 3: Assemble both values**

`GOTRUE_JWT_KEYS` is a bare JSON **array**; `JWT_JWKS` is a `{"keys":[...]}` **object**. In the PostgREST copy the `oct` entry carries `key_ops: ["verify"]` (PostgREST only ever verifies, and a `sign`-only key could be refused by a strict JOSE implementation); in the GoTrue copy it carries `key_ops: ["sign"]` (GoTrue requires exactly one such entry).

```bash
python3 - <<'PY'
import json, urllib.request
oct_sign = json.load(open('/tmp/_oct_sign.json'))
prod = json.load(urllib.request.urlopen(
    "https://gzhxgoigflftharcmdqj.supabase.co/auth/v1/.well-known/jwks.json"))["keys"]
oct_verify = dict(oct_sign, key_ops=["verify"])
gotrue_keys = [oct_sign] + prod
pgrst_jwks  = {"keys": [oct_verify] + prod}
open('/tmp/_gotrue_keys.json','w').write(json.dumps(gotrue_keys, separators=(',',':')))
open('/tmp/_pgrst_jwks.json','w').write(json.dumps(pgrst_jwks, separators=(',',':')))
print("GOTRUE_JWT_KEYS entries:", len(gotrue_keys), "| JWT_JWKS entries:", len(pgrst_jwks["keys"]))
PY
```
Expected: `3` and `3`.

- [ ] **Step 4: Offline-validate both values before they can ever reach a container**

This is the step that prevents a GoTrue crash-loop. All five checks must pass.

```bash
python3 - <<'PY'
import base64, json, re, urllib.request
secret = None
for line in open('env', encoding='utf-8'):
    m = re.match(r'^JWT_SECRET="(.*)"$', line.rstrip('\n'))
    if m: secret = m.group(1)
gk = json.load(open('/tmp/_gotrue_keys.json'))
pj = json.load(open('/tmp/_pgrst_jwks.json'))
prod = json.load(urllib.request.urlopen(
    "https://gzhxgoigflftharcmdqj.supabase.co/auth/v1/.well-known/jwks.json"))["keys"]

# 1. both parse as the right shape
assert isinstance(gk, list) and isinstance(pj, dict) and isinstance(pj["keys"], list)
# 2. exactly one signing key in the GoTrue array
signing = [k for k in gk if "sign" in k.get("key_ops", [])]
assert len(signing) == 1, f"expected exactly 1 signing key, got {len(signing)}"
# 3. the oct k round-trips to the exact secret bytes
kk = signing[0]["k"]; kk += "=" * (-len(kk) % 4)
assert base64.urlsafe_b64decode(kk) == secret.encode('ascii'), "oct k does not decode to JWT_SECRET"
# 4. all kids distinct
kids = [k["kid"] for k in gk]
assert len(kids) == len(set(kids)), f"duplicate kid: {kids}"
# 5. production entries copied verbatim, unmodified
assert [k for k in gk if k.get("kty") == "EC"] == prod, "production keys were altered"
print("ALL 5 CHECKS PASSED | kids:", kids)
PY
```
Expected: `ALL 5 CHECKS PASSED` and 3 distinct kids. If any assertion fails, stop — do not proceed to Task 2 with an unvalidated value.

- [ ] **Step 5: Write both into the repo-root `env` file**

Append (never print the values themselves):
```bash
python3 - <<'PY'
gk = open('/tmp/_gotrue_keys.json').read()
pj = open('/tmp/_pgrst_jwks.json').read()
with open('env','a',encoding='utf-8') as f:
    f.write('\n# Phase 5b: JWKS verification of production ES256 tokens (added 2026-08-31).\n')
    f.write('# GOTRUE_JWT_KEYS = one oct/HS256 signing key (self-hosted\'s existing secret)\n')
    f.write('# + production\'s 2 ES256 public keys, verify-only. Must NEVER be empty - a\n')
    f.write('# blank value crash-loops GoTrue. See the Phase 5b design spec, section 1a.\n')
    f.write(f'GOTRUE_JWT_KEYS={gk}\n')
    f.write(f'JWT_JWKS={pj}\n')
PY
grep -c '^GOTRUE_JWT_KEYS=\|^JWT_JWKS=' env
```
Expected: `2`. Note these are written **unquoted** — a JSON blob wrapped in shell quotes would be read back with the quotes included by the `.env` parsers used in Task 2.

- [ ] **Step 6: Clean up the temp files and confirm no live infrastructure was touched**

```bash
rm -f /tmp/_oct_sign.json /tmp/_gotrue_keys.json /tmp/_pgrst_jwks.json
ssh hostinger-vps "docker ps --filter name=i64jlyerora7ao9vkw5sweh3 --format '{{.Names}}\t{{.Status}}'"
```
Expected: all 7 containers healthy with **unchanged** uptimes — this task is local-only. `env` is gitignored, so there is no commit in this task.

---

### Task 2: Register, recreate, and verify

**Files:**
- Modify (on the VPS, not in this repo): `/data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env`
- Modify: `deploy/selfhosted-supabase/README.md`

**Interfaces:**
- Consumes: Task 1's `GOTRUE_JWT_KEYS` and `JWT_JWKS` from the repo-root `env` file (must exist and have passed Task 1 Step 4's validation).
- Produces: nothing further tasks depend on — last task in this plan.

- [ ] **Step 1: Capture the pre-change baseline**

```bash
ssh hostinger-vps "docker ps --filter name=i64jlyerora7ao9vkw5sweh3 --format '{{.Names}}\t{{.CreatedAt}}'"
ANON=$(ssh hostinger-vps "grep '^ANON_KEY=' /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env | cut -d= -f2-")
ssh hostinger-vps "curl -s -o /dev/null -w 'rest with anon: %{http_code}\n' -H \"apikey: ${ANON}\" -H \"Authorization: Bearer ${ANON}\" 'https://supabase.sosservices.online/rest/v1/profiles?limit=1'"
```
Record every container's `CreatedAt` verbatim — Step 6 diffs against it. Expected: `rest with anon: 200` (this is the regression baseline that must still hold at the end).

- [ ] **Step 2: Register `JWT_JWKS` in Coolify's env store (PATCH — the key already exists)**

```bash
cd H:/Projects/logic-nexus-ai
TOKEN=$(grep -E '^COOLIFY_API_TOKEN=' env | sed 's/^COOLIFY_API_TOKEN="//;s/"$//')
VAL=$(grep '^JWT_JWKS=' env | cut -d= -f2-)
python3 - "$TOKEN" "$VAL" <<'PY'
import json, sys, urllib.request
token, val = sys.argv[1], sys.argv[2]
url = "http://72.61.249.111:8000/api/v1/applications/i64jlyerora7ao9vkw5sweh3/envs"
for preview in (False, True):
    body = {"key": "JWT_JWKS", "value": val}
    if preview: body["is_preview"] = True
    req = urllib.request.Request(url, method="PATCH",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    r = json.load(urllib.request.urlopen(req))
    print("preview" if preview else "production", "->", r.get("uuid"), "is_preview:", r.get("is_preview"))
PY
```
Expected: two lines, each with a `uuid` — these must match the two pre-existing `JWT_JWKS` entries, not new ones (a `GET` on the same endpoint filtered to `"key": "JWT_JWKS"` should still show exactly 2 entries afterward).

- [ ] **Step 3: Register `GOTRUE_JWT_KEYS` in Coolify's env store (POST — the key does not exist yet)**

Same shape as Step 2, but `method="POST"` and `key="GOTRUE_JWT_KEYS"`, reading `VAL` from `env`'s `GOTRUE_JWT_KEYS=` line instead. Per this project's established convention the POST body is exactly `{key, value}` (plus `is_preview` for the second call) — Coolify rejects an `is_build_time` field with a 422.

Expected: two `201`s with two new `uuid`s. Then confirm with a `GET`, filtered to `"key": "GOTRUE_JWT_KEYS"`: exactly 2 entries, one `is_preview: false`, one `is_preview: true`. If more than 2 appear, stop and report — a duplicate would mean an unclear source of truth for a value that crash-loops `auth` when wrong.

- [ ] **Step 4: Update the on-disk `.env` on the VPS**

The manual `docker compose` invocation in Step 5 reads this file, not Coolify's store. Both must agree.

```bash
GK=$(grep '^GOTRUE_JWT_KEYS=' env | cut -d= -f2-)
PJ=$(grep '^JWT_JWKS=' env | cut -d= -f2-)
printf '%s\n' "$GK" > /tmp/_gk.txt && printf '%s\n' "$PJ" > /tmp/_pj.txt
scp /tmp/_gk.txt /tmp/_pj.txt hostinger-vps:/tmp/
ssh hostinger-vps "cd /data/coolify/applications/i64jlyerora7ao9vkw5sweh3 && \
  sed -i '/^JWT_JWKS=/d;/^GOTRUE_JWT_KEYS=/d' .env && \
  printf 'GOTRUE_JWT_KEYS=%s\n' \"\$(cat /tmp/_gk.txt)\" >> .env && \
  printf 'JWT_JWKS=%s\n' \"\$(cat /tmp/_pj.txt)\" >> .env && \
  grep -c '^GOTRUE_JWT_KEYS=\|^JWT_JWKS=' .env"
rm -f /tmp/_gk.txt /tmp/_pj.txt
ssh hostinger-vps "rm -f /tmp/_gk.txt /tmp/_pj.txt"
```
Expected: `2`. The `sed` delete-then-append guards against the concatenation bug Phase 4 Batch 2 hit when appending to this file. Verify the byte lengths of both lines match the local values before continuing.

- [ ] **Step 5: Recreate `auth` and `rest`**

```bash
ssh hostinger-vps "cd /data/coolify/applications/i64jlyerora7ao9vkw5sweh3 && docker compose -p i64jlyerora7ao9vkw5sweh3 --env-file .env -f docker-compose.yaml up -d auth rest"
```

- [ ] **Step 6: IMMEDIATELY check `auth` is healthy — this is the crash-loop gate**

```bash
sleep 8
ssh hostinger-vps "docker ps -a --filter name=auth-i64jlyerora7ao9vkw5sweh3 --format '{{.Names}}\t{{.Status}}'"
ssh hostinger-vps "docker logs \$(docker ps -a --filter name=auth-i64jlyerora7ao9vkw5sweh3 --format '{{.Names}}' | head -1) --tail 40"
```
Expected: `Up ... (healthy)`, and logs free of `unexpected end of JSON input`, `no signing key detected`, or `multiple signing keys detected`.

**If `auth` is restarting/crash-looping, roll back immediately — do not debug forward with auth down:** delete the `GOTRUE_JWT_KEYS` entries from Coolify (`DELETE .../envs/{uuid}` for both uuids from Step 3), remove the line from the VPS `.env` (`sed -i '/^GOTRUE_JWT_KEYS=/d'`), re-run Step 5, and confirm `auth` returns healthy. **Delete the variable — never blank it**; a present-but-empty value produces the identical crash. Then report.

Also confirm the collateral blast radius: compare all 7 containers' `CreatedAt` against Step 1's baseline. `auth`/`rest` are expected to be fresh; per Phase 5's `env_file`-wide finding others may also have been recreated — record what actually happened rather than assuming, and confirm `db` in particular was not.

- [ ] **Step 7: Confirm the JSON survived `.env` → compose → container intact**

A multi-line-hostile JSON blob passing through a `.env` file and compose interpolation is a real failure mode; check the container's actual resolved value rather than trusting the file.

```bash
ssh hostinger-vps "docker exec \$(docker ps --filter name=auth-i64jlyerora7ao9vkw5sweh3 --format '{{.Names}}') printenv GOTRUE_JWT_KEYS" | python3 -c "import sys,json; d=json.load(sys.stdin); print('parsed OK, entries:', len(d), '| kids:', [k['kid'] for k in d])"
ssh hostinger-vps "docker exec \$(docker ps --filter name=rest-i64jlyerora7ao9vkw5sweh3 --format '{{.Names}}') printenv PGRST_JWT_SECRET" | python3 -c "import sys,json; d=json.load(sys.stdin); print('parsed OK, entries:', len(d['keys']))"
```
Expected: both parse, 3 entries each, 3 distinct kids. Piping through `json` is deliberate — it proves validity without printing the `oct` key's `k`.

- [ ] **Step 8: The headline check — a real production token is no longer rejected for its algorithm**

Use the production token sampled during Phase 5's review (recorded in that phase's history). **It has since expired**, so `200` is not the expected result and its absence is not a failure. The pass criterion is the *error changing kind*:

- **Before this phase:** `403 {"code":"bad_jwt","msg":"invalid JWT: unable to parse or verify signature, token signature is invalid: signing method ES256 is invalid"}` — rejected at the algorithm gate, signature never checked.
- **Expected now:** an **expiry** error (e.g. `token is expired`), which can only be reached *after* the signature verified successfully against production's public key. Any message still mentioning `signing method`, `signature is invalid`, or `unrecognized JWT kid` means the phase has **not** worked.

```bash
ANON=$(ssh hostinger-vps "grep '^ANON_KEY=' /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env | cut -d= -f2-")
ssh hostinger-vps "curl -s -H \"apikey: ${ANON}\" -H 'Authorization: Bearer <the production token>' https://supabase.sosservices.online/auth/v1/user"
```
If the plan owner can supply a **fresh** production token, use that instead and expect a clean `200` with real user data — strictly stronger evidence. Report which of the two was used.

- [ ] **Step 9: Regression guard — `ANON_KEY`/`SERVICE_ROLE_KEY` still work, on both services**

This is the specific breakage spec §1a Finding 1 exists to prevent, and the most likely way this phase goes wrong. The two services resolve keys by different mechanisms (PostgREST from the `JWT_JWKS` blob; GoTrue from its `kid`-less HS256 fallback), so one passing does not imply the other.

```bash
ANON=$(ssh hostinger-vps "grep '^ANON_KEY=' /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env | cut -d= -f2-")
SRK=$(ssh hostinger-vps "grep '^SERVICE_ROLE_KEY=' /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env | cut -d= -f2-")
ssh hostinger-vps "curl -s -o /dev/null -w 'rest+anon: %{http_code}\n' -H \"apikey: ${ANON}\" -H \"Authorization: Bearer ${ANON}\" 'https://supabase.sosservices.online/rest/v1/profiles?limit=1'"
ssh hostinger-vps "curl -s -o /dev/null -w 'auth+srk: %{http_code}\n' -H \"apikey: ${SRK}\" -H \"Authorization: Bearer ${SRK}\" 'https://supabase.sosservices.online/auth/v1/admin/users?page=1&per_page=1'"
```
Expected: both `200`. A `401 PGRST301` or a `403 bad_jwt` here means `ValidMethods` no longer includes HS256 — stop and roll back per Step 6's procedure.

- [ ] **Step 10: Confirm self-hosted can still issue and verify its own tokens**

```bash
SRK=$(ssh hostinger-vps "grep '^SERVICE_ROLE_KEY=' /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env | cut -d= -f2-")
ANON=$(ssh hostinger-vps "grep '^ANON_KEY=' /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env | cut -d= -f2-")
ssh hostinger-vps "curl -s -X POST https://supabase.sosservices.online/auth/v1/admin/users -H \"apikey: ${SRK}\" -H \"Authorization: Bearer ${SRK}\" -H 'Content-Type: application/json' -d '{\"email\":\"phase5b-verify-test@sosservices.online\",\"password\":\"Phase5bVerify!2026\",\"email_confirm\":true}'"
ssh hostinger-vps "curl -s -X POST 'https://supabase.sosservices.online/auth/v1/token?grant_type=password' -H \"apikey: ${ANON}\" -H 'Content-Type: application/json' -d '{\"email\":\"phase5b-verify-test@sosservices.online\",\"password\":\"Phase5bVerify!2026\"}'"
```
(The public `/auth/v1/signup` route stays unusable due to the pre-existing SMTP gap — the Admin API is the same substitute Phases 5 and 5a used.) Take the returned `access_token`, decode its **header** and record whether it now carries `kid: selfhosted-legacy-hs256` (expected once `JWT_KEYS` is configured, and harmless either way), then confirm it validates:
```bash
ssh hostinger-vps "curl -s -o /dev/null -w 'own token: %{http_code}\n' -H \"apikey: ${ANON}\" -H 'Authorization: Bearer <that token>' https://supabase.sosservices.online/auth/v1/user"
```
Expected: `200`.

- [ ] **Step 11: Clean up the test user**

```bash
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-054239087325 psql -U supabase_admin -d postgres -c \"DELETE FROM public.profiles WHERE email='phase5b-verify-test@sosservices.online'; DELETE FROM auth.identities WHERE user_id=(SELECT id FROM auth.users WHERE email='phase5b-verify-test@sosservices.online'); DELETE FROM auth.users WHERE email='phase5b-verify-test@sosservices.online';\""
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-054239087325 psql -U supabase_admin -d postgres -tAc \"SELECT count(*) FROM auth.users; SELECT count(*) FROM auth.identities; SELECT count(*) FROM public.profiles;\""
```
Expected: `103` / `101` / `104` — unchanged from Phase 5, confirming this phase touched no real user data.

- [ ] **Step 12: Health curls, and re-confirm production's JWKS didn't move mid-implementation**

Run the four standard curls (command in Global Constraints; expected all `200`), then:
```bash
curl -s "https://gzhxgoigflftharcmdqj.supabase.co/auth/v1/.well-known/jwks.json" | python3 -c "import sys,json; print([k['kid'] for k in json.load(sys.stdin)['keys']])"
```
Expected: the same kids Task 1 Step 1 recorded. If they changed during implementation, the deployed config is already stale — report it rather than declaring the phase done.

- [ ] **Step 13: Document in the README and commit**

Add a "Phase 5b" section to `deploy/selfhosted-supabase/README.md` covering: that self-hosted now verifies production's ES256 tokens via `GOTRUE_JWT_KEYS`/`JWT_JWKS`; the one-signing-key + verify-only-keys structure and why the signing key stayed HS256 (so `ANON_KEY`/`SERVICE_ROLE_KEY` needed no regeneration); the **never-blank `GOTRUE_JWT_KEYS`** hazard and the delete-don't-blank rollback; that no compose change was needed because Coolify injects its whole env store into every container; and that the JWKS is a **static snapshot** requiring a manual re-check before the real cutover. Also update the "Open items before cutover" section: this closes the JWT-verification item for `auth`/`rest`, and leaves `storage`, `realtime`, and the `functions` router (hardcoded HMAC, 109 functions) still open.

```bash
git add deploy/selfhosted-supabase/README.md
git commit -m "docs(selfhost-supabase): document Phase 5b JWKS verification of production tokens"
```
(`env` is gitignored and is never committed.)

---

## Plan Self-Review

**Spec coverage:** §2 Goals → Task 2 Steps 8 (production tokens accepted), 10 (own issuance intact), 9 (`ANON_KEY`/`SERVICE_ROLE_KEY` untouched *and* verified still working). §3's 7 approach steps → Task 1 Steps 1-3 (fetch, derive `oct`, assemble) and Task 2 Steps 2-6 (register both, recreate `auth`/`rest`, never `db`). §4's 6 verification points → Task 2 Steps 8, 10, 9, 12, 11, 12 respectively. §5 Rollback → Task 2 Step 6's inline procedure, including the delete-don't-blank rule. §1a Finding 3a's crash hazard → Global Constraints plus Task 1 Step 4's five-check gate, which is the reason the plan is split into two tasks at all. §2's three non-goals (`storage`, `realtime`, `functions`) → carried into Step 13's README update rather than silently dropped.

**Placeholder scan:** No TBD/TODO. `<the production token>` in Step 8 and `<that token>` in Step 10 are runtime values that cannot be known at planning time (one is a secret held by the plan owner, the other is generated by the step immediately before it) — both are described precisely enough to act on, matching how Phases 5/5a handled the same situation. Step 3 deliberately describes a variant of Step 2's script rather than repeating 20 lines verbatim; the two differences (HTTP method, key name) are stated explicitly, and this is a same-task adjacent step rather than the cross-task "similar to Task N" shortcut the skill forbids.

**Type/name consistency:** `GOTRUE_JWT_KEYS` (bare JSON array) and `JWT_JWKS` (`{"keys":[...]}` object) keep those exact shapes and names across Task 1 Steps 3/4/5 and Task 2 Steps 2/3/4/7 — including the deliberate asymmetry that the `oct` entry is `key_ops:["sign"]` in the first and `["verify"]` in the second, stated once in Task 1 Step 3 and relied on in Task 2 Step 7's differing assertions. The `kid` `selfhosted-legacy-hs256` is fixed in Task 1 Step 2 and referenced identically in Task 2 Step 10. Container names and the Coolify UUID match Global Constraints everywhere they appear.

# Incident: Production Credentials Committed to Git

**Date discovered:** 2026-05-14  
**Severity:** P0 — Critical  
**Status:** Mitigated (history not yet purged)

## What happened

The `.env` file containing live production credentials was committed to the git repository in multiple commits spanning the project history (earliest: `e80b8167`, most recent before removal: `5c16464a`). A total of 42 commits include the file.

## Credentials exposed

| Credential | Service | Risk |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Full DB admin, bypasses all RLS |
| `DB_PASSWORD` / `DATABASE_URL` | PostgreSQL | Direct DB access |
| `SUPABASE_ACCESS_TOKEN` | Supabase Management API | Project-level admin |
| `SUPABASE_ANON_KEY` | Supabase | Client-side key (lower risk) |
| `OPENAI_API_KEY` | OpenAI | API billing / data |
| `VITE_OPENAI_API_KEY` | OpenAI | Same key, VITE prefix |
| `GOOGLE_API_KEY` | Google Cloud | API billing |

## Blast radius

- Repository is **private** on GitHub — reduces external exposure
- Collaborators with historic read access may have the credentials
- Service-role key enables full read/write/delete on all tables as authenticated user, bypassing RLS

## Immediate actions taken

- [x] `.env` removed from git tracking (commit `77b82f61`)
- [x] `.env` added to `.gitignore`
- [ ] **Rotate SUPABASE_SERVICE_ROLE_KEY** — Supabase dashboard → Settings → API
- [ ] **Rotate SUPABASE_ACCESS_TOKEN** — Supabase dashboard → Account → Access Tokens
- [ ] **Reset DB password** — Supabase dashboard → Settings → Database
- [ ] **Rotate OPENAI_API_KEY** — platform.openai.com/api-keys
- [ ] **Revoke GOOGLE_API_KEY** — console.cloud.google.com/apis/credentials
- [ ] Update `.env` locally with new values
- [ ] Update GitHub Actions secrets in repo settings

## Follow-up actions

- [ ] Purge `.env` from git history using `git filter-repo --path .env --invert-paths`
- [ ] Force-push rewritten history (coordinate with all collaborators)
- [ ] Add Gitleaks pre-commit hook (see `.gitleaks.toml`)
- [ ] Add Gitleaks step to CI (already added to `.github/workflows/ci.yml`)
- [ ] Review Supabase access logs for anomalous activity since first exposure
- [ ] Audit which Edge Functions use service-role key — none should be user-callable without auth checks

## History purge procedure

```bash
# Install git-filter-repo
pip install git-filter-repo

# Rewrite history, removing .env from all commits
git filter-repo --path .env --invert-paths

# Verify .env is gone from all commits
git log --all --oneline -- .env

# Force-push rewritten history (DESTRUCTIVE — coordinate with team first)
git push origin --force --all
git push origin --force --tags
```

**Warning:** History rewrite changes all commit SHAs. All collaborators must `git clone` fresh or run `git fetch --all && git reset --hard origin/main`.

## Lessons

- `.env` should have been in `.gitignore` from project inception
- Pre-commit hook (Gitleaks) now prevents future credential commits
- CI secret scanner now blocks PRs that introduce secrets

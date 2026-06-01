#!/usr/bin/env bash
#
# Phase 6 Step 60 — smoke-test runner for supabase/tests/*.sql.
#
# Each smoke file is a self-contained DO block that creates synthetic
# data, asserts behavior, and DELETEs the data at the end (or rolls
# back via a raised exception if any assertion fails). The runner
# iterates every *.sql under supabase/tests/, executes it with psql
# under ON_ERROR_STOP=1, and tallies pass/fail.
#
# Usage:
#   DATABASE_URL="postgresql://..." ./scripts/run-supabase-smokes.sh
#
#   # Limit to specific tests:
#   DATABASE_URL="..." ./scripts/run-supabase-smokes.sh compliance_*
#
#   # Or against prod via Supabase pooler:
#   DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres" \
#     ./scripts/run-supabase-smokes.sh
#
# Designed to run in CI: exits 0 only if every smoke passed; exits 1
# if any failed. Stdout is the per-test psql output; stderr is the
# summary banner.
#
# Each smoke is intentionally self-cleaning, but be aware: a few leave
# expected residue (e.g. core.audit_log rows from override smokes —
# append-only by design). The per-test header documents what stays.

set -euo pipefail

# ──────────────────────────────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────────────────────────────

: "${DATABASE_URL:?DATABASE_URL must be set (postgresql://...)}"

TESTS_DIR="${TESTS_DIR:-supabase/tests}"
PSQL_BIN="${PSQL_BIN:-psql}"

# Color codes (skipped when stdout is not a TTY)
if [[ -t 1 ]]; then
  RED=$'\033[0;31m'
  GREEN=$'\033[0;32m'
  YELLOW=$'\033[0;33m'
  CYAN=$'\033[0;36m'
  RESET=$'\033[0m'
else
  RED='' GREEN='' YELLOW='' CYAN='' RESET=''
fi

# ──────────────────────────────────────────────────────────────────────
# Discover tests
# ──────────────────────────────────────────────────────────────────────

if [[ ! -d "$TESTS_DIR" ]]; then
  echo "${RED}error:${RESET} TESTS_DIR=$TESTS_DIR not found" >&2
  exit 2
fi

declare -a TEST_FILES=()

if [[ $# -gt 0 ]]; then
  # Caller passed glob patterns — expand within the tests dir
  for pattern in "$@"; do
    while IFS= read -r f; do
      TEST_FILES+=("$f")
    done < <(find "$TESTS_DIR" -maxdepth 1 -type f -name "${pattern}.sql" -o -name "${pattern}" 2>/dev/null | sort -u)
  done
else
  while IFS= read -r f; do
    TEST_FILES+=("$f")
  done < <(find "$TESTS_DIR" -maxdepth 1 -type f -name '*.sql' | sort)
fi

TOTAL="${#TEST_FILES[@]}"
if [[ "$TOTAL" -eq 0 ]]; then
  echo "${YELLOW}warning:${RESET} no smoke tests matched" >&2
  exit 0
fi

# ──────────────────────────────────────────────────────────────────────
# Run
# ──────────────────────────────────────────────────────────────────────

echo "${CYAN}== Smoke harness ==${RESET}" >&2
echo "  tests:   $TOTAL files under $TESTS_DIR" >&2
echo "  target:  ${DATABASE_URL%%\?*}" >&2  # strip query-string secrets
echo "" >&2

PASS=0
FAIL=0
declare -a FAILED=()
START_TS=$(date +%s)

for f in "${TEST_FILES[@]}"; do
  name=$(basename "$f" .sql)
  printf "${CYAN}▶${RESET} %-50s " "$name" >&2

  t0=$(date +%s)
  # Note: -X disables psqlrc; -q quiets the "DO" / "NOTICE" noise but
  # keeps RAISE NOTICE output from the DO blocks (which is the actual
  # assertion log). Errors go to stderr with full context.
  if output=$("$PSQL_BIN" "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$f" 2>&1); then
    t1=$(date +%s)
    printf "${GREEN}PASS${RESET} (%ds)\n" "$((t1 - t0))" >&2
    PASS=$((PASS + 1))
  else
    t1=$(date +%s)
    printf "${RED}FAIL${RESET} (%ds)\n" "$((t1 - t0))" >&2
    echo "$output" | sed 's/^/    /' >&2
    FAIL=$((FAIL + 1))
    FAILED+=("$name")
  fi
done

END_TS=$(date +%s)

# ──────────────────────────────────────────────────────────────────────
# Summary
# ──────────────────────────────────────────────────────────────────────

echo "" >&2
echo "${CYAN}== Results ==${RESET}" >&2
printf "  ${GREEN}passed${RESET}: %d / %d\n" "$PASS" "$TOTAL" >&2
if [[ "$FAIL" -gt 0 ]]; then
  printf "  ${RED}failed${RESET}: %d\n" "$FAIL" >&2
  for n in "${FAILED[@]}"; do
    echo "    - $n" >&2
  done
fi
printf "  ${CYAN}elapsed${RESET}: %ds\n" "$((END_TS - START_TS))" >&2

[[ "$FAIL" -eq 0 ]]

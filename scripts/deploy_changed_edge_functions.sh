#!/usr/bin/env bash
# Deploys Supabase Edge Functions whose source changed in the last commit.
#
# Why git-diff scoped: there are ~127 functions in supabase/functions/;
# blanket re-deploys are slow and churn cf-cache. We only touch what
# changed. When supabase/functions/_shared/ changes, every function is
# affected, so we deploy all.
#
# Env required: PROJECT_REF, SUPABASE_ACCESS_TOKEN.
# Optional:     DEPLOY_BASE_REF (default: HEAD~1) — git ref to diff against.

set -euo pipefail

PROJECT_REF="${PROJECT_REF:-}"
DEPLOY_BASE_REF="${DEPLOY_BASE_REF:-HEAD~1}"

if [ -z "$PROJECT_REF" ]; then
  echo "PROJECT_REF empty (DB_TARGET=local likely); skipping edge-function deploy."
  exit 0
fi
if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "Error: SUPABASE_ACCESS_TOKEN env not set" >&2
  exit 1
fi

# Skip cleanly if there's no prior commit to diff against (first build).
if ! git rev-parse --verify "$DEPLOY_BASE_REF" >/dev/null 2>&1; then
  echo "No $DEPLOY_BASE_REF available; skipping edge-function deploy (first build)."
  exit 0
fi

# Collect changed paths under supabase/functions/.
CHANGED=$(git diff --name-only "$DEPLOY_BASE_REF" HEAD -- supabase/functions/ || true)
if [ -z "$CHANGED" ]; then
  echo "No edge-function changes since $DEPLOY_BASE_REF; nothing to deploy."
  exit 0
fi

# If _shared/ or deno.json or import_map.json changed, deploy everything.
if echo "$CHANGED" | grep -qE '^supabase/functions/(_shared/|deno\.json|import_map\.json)'; then
  echo "Shared edge-function code changed — deploying all functions."
  # Skip directories starting with _ (these are conventions, not functions).
  mapfile -t FUNC_NAMES < <(
    find supabase/functions -mindepth 1 -maxdepth 1 -type d \
      ! -name '_*' -printf '%f\n' | sort
  )
else
  # Extract function names: supabase/functions/<NAME>/...
  mapfile -t FUNC_NAMES < <(
    echo "$CHANGED" \
      | awk -F/ '$3 != "" && $3 !~ /^_/ { print $3 }' \
      | sort -u
  )
fi

if [ "${#FUNC_NAMES[@]}" -eq 0 ]; then
  echo "Changes detected but no deployable functions resolved; skipping."
  exit 0
fi

echo "Deploying ${#FUNC_NAMES[@]} function(s):"
printf '  - %s\n' "${FUNC_NAMES[@]}"

# verify_jwt is intentionally NOT passed here; each function declares its
# own auth mode (most use --no-verify-jwt and authenticate internally via
# requireAuth — see supabase/functions/_shared/auth.ts). The CLI honours
# whatever was set on the prior deploy and rejects a flag flip without
# --no-verify-jwt being explicit. We default to --no-verify-jwt to match
# the existing platform pattern (see scripts/deploy_functions_ci.sh).
for fn in "${FUNC_NAMES[@]}"; do
  echo "→ supabase functions deploy $fn"
  npx --yes supabase@^2 functions deploy "$fn" \
    --project-ref "$PROJECT_REF" \
    --no-verify-jwt
done

echo "Edge function deploy complete."

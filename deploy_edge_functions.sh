#!/bin/bash

# Configuration
PROJECT_REF="gzhxgoigflftharcmdqj"
FUNCTIONS_DIR="supabase/functions"
LOG_FILE="deployment_log_$(date +%Y%m%d_%H%M%S).txt"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${2:-$NC}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

log "Starting comprehensive re-deployment to project: $PROJECT_REF" "$GREEN"
log "Log file: $LOG_FILE"

# 1. Pre-flight Checks
log "1. Pre-flight Checks..." "$YELLOW"
HAS_DENO=false
if command -v deno &> /dev/null; then
    HAS_DENO=true
    log "Deno found." "$GREEN"
else
    log "Warning: 'deno' command not found. Skipping local syntax check." "$YELLOW"
fi

if ! command -v npm &> /dev/null; then
    log "Error: npm could not be found." "$RED"
    exit 1
fi
log "Pre-flight checks passed (npm found)." "$GREEN"

# 2. Function Discovery
log "2. Discovering Edge Functions..." "$YELLOW"
FUNCTIONS=()
for dir in "$FUNCTIONS_DIR"/*; do
    if [ -d "$dir" ]; then
        func_name=$(basename "$dir")
        # Skip internal/shared folders
        if [[ "$func_name" == _* ]] || [[ "$func_name" == "node_modules" ]]; then
            continue
        fi
        if [ -f "$dir/index.ts" ]; then
            FUNCTIONS+=("$func_name")
        fi
    fi
done

log "Found ${#FUNCTIONS[@]} functions to deploy."
# echo "${FUNCTIONS[@]}" | tee -a "$LOG_FILE"

# 3. Verification & Deployment Loop
log "3. Starting Verification and Deployment..." "$YELLOW"

DEPLOY_SUCCESS=0
DEPLOY_FAIL=0

for func_name in "${FUNCTIONS[@]}"; do
    log "--------------------------------------------------"
    log "Processing: $func_name" "$YELLOW"
    
    FUNC_PATH="$FUNCTIONS_DIR/$func_name/index.ts"

    # Step 3a: Verification (Code Quality/Syntax)
    if [ "$HAS_DENO" = true ]; then
        log "  > Verifying syntax..."
        IMPORT_MAP_FLAG=""
        if [ -f "$FUNCTIONS_DIR/import_map.json" ]; then
            IMPORT_MAP_FLAG="--import-map=$FUNCTIONS_DIR/import_map.json"
        fi

        if deno check $IMPORT_MAP_FLAG "$FUNC_PATH" 2>> "$LOG_FILE"; then
            log "  > Syntax check passed." "$GREEN"
        else
            log "  > Syntax check FAILED. Skipping deployment." "$RED"
            ((DEPLOY_FAIL++))
            continue
        fi
    else
        log "  > Skipping local syntax check (deno not found)." "$YELLOW"
    fi

    # Step 3b: Deployment
    log "  > Deploying to $PROJECT_REF..."
    # Deploy command: npx supabase functions deploy <name> --project-ref <ref>
    # Note: Using --no-verify-jwt is usually for serving, not deploying. Deployment just uploads.
    # If the function requires secrets, ensure they are set via 'supabase secrets set' beforehand, 
    # but we assume env is configured or we'll deploy anyway.
    
    if npx supabase functions deploy "$func_name" --project-ref "$PROJECT_REF" --no-verify-jwt 2>&1 | tee -a "$LOG_FILE"; then
        log "  > Deployment command finished." "$GREEN"
        
        # Check if the output contains "Error" (since npx might return 0 even on some failures)
        if grep -q "Error" <<< "$(tail -n 5 "$LOG_FILE")"; then
             log "  > Deployment likely FAILED (check logs)." "$RED"
             ((DEPLOY_FAIL++))
        else
             ((DEPLOY_SUCCESS++))
             
             # Step 4: Post-deployment Validation (Health Check)
             FUNC_URL="https://$PROJECT_REF.supabase.co/functions/v1/$func_name"
             log "  > Validating endpoint: $FUNC_URL"
             
             # Use a 5-second timeout (-m 5)
             HTTP_CODE=$(curl -sS -m 5 -o /dev/null -w "%{http_code}" "$FUNC_URL" 2>> "$LOG_FILE")
             CURL_EXIT=$?
             
             if [ $CURL_EXIT -ne 0 ]; then
                 log "  > Health check FAILED (curl error $CURL_EXIT). Check network/DNS." "$RED"
                 # Don't mark deployment as failed just because health check failed (could be network), 
                 # but log it clearly.
             elif [[ "$HTTP_CODE" == "401" ]] || [[ "$HTTP_CODE" == "200" ]]; then
                  log "  > Health check PASSED (HTTP $HTTP_CODE)." "$GREEN"
             elif [[ "$HTTP_CODE" == "400" ]] || [[ "$HTTP_CODE" == "405" ]]; then
                  log "  > Health check PASSED (HTTP $HTTP_CODE - Request Reached)." "$GREEN"
             else
                  log "  > Health check WARNING (HTTP $HTTP_CODE). Check logs." "$RED"
             fi
        fi

    else
        log "  > Deployment FAILED (npx exit code)." "$RED"
        ((DEPLOY_FAIL++))
    fi
done

log "--------------------------------------------------"
log "Deployment Summary" "$YELLOW"
log "Total Functions: ${#FUNCTIONS[@]}"
log "Successful Deployments: $DEPLOY_SUCCESS" "$GREEN"
log "Failed Deployments: $DEPLOY_FAIL" "$RED"

if [ $DEPLOY_FAIL -eq 0 ]; then
    log "All deployments successful." "$GREEN"
else
    log "Some deployments failed. Check $LOG_FILE for details." "$RED"
fi

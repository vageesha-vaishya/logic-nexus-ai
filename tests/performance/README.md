# Performance Testing

This directory contains performance testing scripts using [k6](https://k6.io/).

## Prerequisites

1.  Install k6:
    *   **Mac:** `brew install k6`
    *   **Windows:** `winget install k6`
    *   **Linux:** `sudo apt-key adv ...` (see [official docs](https://k6.io/docs/get-started/installation/))

## Running Tests

### Local Testing

To run the load test against your local Supabase Edge Functions:

1.  Ensure your local Supabase instance is running (`supabase start`).
2.  Get an anon key or service role key if needed.
3.  Run the script:

```bash
k6 run -e API_URL=http://localhost:54321/functions/v1 -e AUTH_TOKEN=your_token_here tests/performance/k6-script.js
```

### CI/CD Integration

The `k6-script.js` is designed to be run in a CI environment. You can use the official `grafana/k6` Docker image or the GitHub Action.

## Scenarios

*   **Ramp up:** 30s to 20 users
*   **Steady state:** 1m at 20 users
*   **Ramp down:** 30s to 0 users

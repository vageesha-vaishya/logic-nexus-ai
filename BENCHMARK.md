# Performance Benchmark Guide

This guide describes how to verify the performance improvements implemented in the "Quick Quote" and "Create Detailed Quote" modules.

## Prerequisites
- Google Chrome (or any Chromium-based browser)
- Access to the application running locally or in a staging environment
- React Developer Tools extension (optional but recommended)

## 1. Verifying Pricing Service Optimization

**Goal**: Confirm that financial calculations are near-instantaneous (< 10ms).

**Steps**:
1. Open the browser's Developer Tools (F12).
2. Go to the **Network** tab.
3. Create a new **Quick Quote** or **Detailed Quote**.
4. Observe the speed of calculations when changing margins or selecting rates.
5. **Console Check**:
   - In the console, you can run this snippet if `PricingService` is exposed (or just observe the logs if debug is on):
   - Look for `[PricingService] Calculation time:` logs if available.
   - **Before**: Delays were noticeable (300ms per item).
   - **After**: Calculations should be instant.

## 2. Verifying Quick Quote Performance

**Goal**: Confirm that compliance checks and rate fetching happen concurrently.

**Steps**:
1. Open **Network** tab in DevTools.
2. Open the **Quick Quote** modal.
3. Fill in the required details (Origin, Destination, Commodity).
4. Click **"Get Rates"** (or Submit).
5. **Observation**:
   - Look at the "Waterfall" in the Network tab.
   - You should see the call to `validate_compliance` (AI Advisor) and `rate-engine` (Supabase Function) starting at roughly the same time.
   - **Before**: `validate_compliance` would finish *before* `rate-engine` started.
   - **After**: They overlap. The total time should be `Max(Compliance, RateEngine)` instead of `Sum(Compliance, RateEngine)`.

## 3. Verifying Detailed Quote Master Data Caching

**Goal**: Confirm that master data is fetched only once per session/tenant.

**Steps**:
1. Open **Network** tab and clear it.
2. Navigate to **"Create New Quote"** (Detailed Quote).
3. **First Visit**:
   - You should see multiple requests to `charge_categories`, `charge_sides`, `currencies`, etc. (or a single batch request if using a specific client).
   - Check the **Console** for `[QuoteNew] Fetching master data from DB (Cache Miss/Expired)`.
4. **Second Visit**:
   - Navigate back to the Dashboard, then click **"Create New Quote"** again.
   - **Observation**: You should **NOT** see the network requests for master data again.
   - Check the **Console** for `[QuoteNew] Using cached master data`.

## 4. General Bundle Analysis

**Goal**: Verify that code splitting is working.

**Steps**:
1. Run `npm run build`.
2. Look at the output in `dist/assets`.
3. You should see separate chunks for:
   - `recharts-*.js`
   - `xlsx-*.js`
   - `dnd-kit-*.js`
   - `pdf-export-*.js`
4. This confirms that heavy libraries are not loaded in the main bundle.

## 5. Database Performance (Server-Side)

**Goal**: Ensure queries are efficient.

**Recommendation**:
- Ask the database administrator to verify indexes on `carrier_rates` table:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_carrier_rates_lookup ON carrier_rates (origin_port_id, destination_port_id, mode, status);
  ```

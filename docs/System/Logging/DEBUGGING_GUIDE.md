# Debugging & Logging Guide

## Overview

This guide details the logging infrastructure, schema, and troubleshooting workflows for the Logic Nexus AI platform. It covers the client-side `useDebug` hook, the `logger` utility, and the **Debug Console** for real-time analysis.

## 1. Logging Schema

All logs are structured as JSON objects with the following schema:

```typescript
interface LogEntry {
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  timestamp: string;        // ISO 8601 (e.g., "2026-02-01T12:00:00.000Z")
  module: string;           // Functional area (e.g., "Sales:Quotes")
  form?: string;            // Specific component/form (e.g., "QuickQuoteModal")
  correlation_id?: string;  // Trace ID for request chains
  user_id?: string;         // Masked user identifier
  tenant_id?: string;       // Tenant context
  data?: any;               // Structured payload (masked for PII)
  metadata?: {
    stack?: string;         // Stack trace for errors
    duration?: string;      // Operation duration (e.g., "150.20ms")
    [key: string]: any;
  };
}
```

## 2. Instrumentation Tools

### 2.1 React Components (`useDebug`)

Use the `useDebug` hook for hierarchical logging in React components.

```tsx
import { useDebug } from '@/hooks/useDebug';

const MyComponent = () => {
  // Scope: Module "Sales", Form "OrderEntry"
  const debug = useDebug('Sales', 'OrderEntry');

  useEffect(() => {
    debug.info('Component Mounted', { viewMode: 'detailed' });
  }, []);

  const handleSubmit = async (data) => {
    debug.log('Submitting Order', data); // Level: 'log' (alias for debug/info depending on config)
    try {
      await api.submit(data);
      debug.info('Order Submitted Successfully');
    } catch (err) {
      debug.error('Submission Failed', err);
    }
  };
};
```

### 2.2 Non-React / Utilities (`logger`)

Use the global `logger` for services, utils, or outside React context.

```typescript
import { logger } from '@/lib/logger';

export const calculatePrice = (params) => {
  logger.info('Calculating Price', { params }, 'PricingService');
  // ... logic
};
```

### 2.3 Performance Metrics

To track operation performance, use `performance.now()` to calculate duration and log it with the operation result.

```typescript
const startTime = performance.now();
try {
  await someAsyncOperation();
  const duration = performance.now() - startTime;
  debug.info('Operation Successful', { duration: `${duration.toFixed(2)}ms` });
} catch (err) {
  const duration = performance.now() - startTime;
  debug.error('Operation Failed', err, { duration: `${duration.toFixed(2)}ms` });
}
```

## 3. Debug Console

The **Debug Console** is located at `/dashboard/debug-console`. It provides real-time visibility into client-side logs and network traffic.

### Features
- **Real-time Stream**: View logs as they happen.
- **Hierarchical Filtering**: Toggle specific modules (e.g., enable `Sales` but disable `Inventory`).
- **Network Capture**: Inspect full HTTP Request/Response bodies (headers, payloads).
- **Search**: Filter by message content or metadata.
- **Export**: Download logs as JSON for offline analysis.

### Configuration
- **Active**: Master switch to enable/disable all logging.
- **Network**:
  - `Capture Request/Response Body`: Toggle payload recording.
  - `Max Payload Size`: Limit storage to prevent memory issues.
  - `URL Patterns`: Regex to include/exclude specific APIs.

## 4. Troubleshooting Scenarios

### Scenario A: Quote Submission Fails

1.  **Open Debug Console**: Navigate to `/dashboard/debug-console`.
2.  **Enable Network Capture**: Ensure "Response Body" capture is ON.
3.  **Reproduce**: Go to "Quick Quote", fill details, and click Submit.
4.  **Analyze**:
    - Filter for `Sales:QuickQuoteModal`.
    - Look for `Submitting Quote Request` (INFO).
    - Look for subsequent `ERROR` logs.
    - Check the **Network** tab for the failed API call (e.g., `POST /functions/v1/pricing`).
    - Inspect the **Response Body** in the console to see the server error message.

### Scenario B: AI Suggestion Latency

1.  **Open Debug Console**.
2.  **Reproduce**: Type in "Commodity" field and trigger AI.
3.  **Analyze**:
    - Filter for `AI Suggestion`.
    - Look for `Starting AI Suggestion`.
    - Look for `AI Suggestion Completed`.
    - Check the `data` payload for the `duration` field (e.g., `{ duration: "2500ms" }`).
    - If duration > 2s, check Network tab for `POST /functions/v1/ai-advisor` timing.

### Scenario C: Form Validation Issues

1.  **Open Debug Console**.
2.  **Reproduce**: Submit an empty form.
3.  **Analyze**:
    - Look for `Validation Errors` log.
    - Expand the log to see the `errors` object (e.g., `{ weight: "Required", origin: "Invalid" }`).
    - Verify if the UI matches the validation state.

### Scenario D: Performance Bottlenecks

1.  **Open Debug Console**.
2.  **Analyze**:
    - Filter by module (e.g., `Sales:Quotes`).
    - Search for `duration`.
    - Review operations with high duration values.
    - Correlate with network requests to identify if the bottleneck is client-side or server-side.

## 5. Querying Database Logs (System Logs)

For production issues where client logs are lost or unavailable, query the `system_logs` table in Supabase.

```sql
-- Find recent errors in Quote module
SELECT * FROM system_logs
WHERE level = 'ERROR'
  AND component = 'Sales:Quotes'
  AND timestamp > NOW() - INTERVAL '1 hour'
ORDER BY timestamp DESC;

-- specific Trace ID
SELECT * FROM system_logs
WHERE correlation_id = '123e4567-e89b-12d3-a456-426614174000';
```

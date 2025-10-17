# Example: Hydrate Carrier Rates in Modal

Use this when adding a modal that loads carrier rates on demand.

```
Title: Hydrate carrier rates in modal on demand

Goal
- Load carrier rates lazily and render safely without blocking UI.

Scope & Context
- Paths: /src/components/sales/CarrierRatesModal.tsx, /src/hooks/useCRM.tsx
- In-scope: data fetching, modal state, loading/error UI
- Out-of-scope: backend schema changes
- Tenancy & Security: use tenant_id from auth context; respect RLS

Inputs
- Selected carrier_id, service_type_id, quotation_id
- Env: macOS, node >= 18

Outputs
- CarrierRatesModal shows rates with loading and error states

Acceptance Criteria
1) Spinner displays during fetch; disappears on success
2) Error toast shows on failure; retry works
3) No unhandled promise rejections in console

Implementation Tasks
- Add lazy fetch triggered on open
- Handle loading/error/empty states
- Render rate rows with minimal UI changes

Output Style
- Minimal diff with focused patches
- Non-interactive commands; macOS-compatible

Validation
- Run: npm run dev
- Verify: open modal; check loading and rates render
- Console: no errors; retry works on failure

Risks & Fallbacks
- Network flakiness; add retry and backoff
- Large payloads; paginate or limit results
```
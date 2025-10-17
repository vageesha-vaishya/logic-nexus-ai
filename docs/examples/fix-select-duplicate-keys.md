# Example: Eliminate Duplicate Keys in Select Components

Use this when React warns about duplicate keys in list rendering.

```
Title: Fix duplicate key warnings in Select components

Goal
- Ensure stable identity for SelectItem lists; remove duplicate keys.

Scope & Context
- Paths: /src/components/sales/QuoteForm.tsx
- In-scope: option list mapping and keys
- Out-of-scope: API schemas and unrelated UI
- Tenancy & Security: no change; respect existing filters

Inputs
- Arrays: opportunities, accounts, contacts, ports, services

Outputs
- No duplicate key warnings in console

Acceptance Criteria
1) Console shows no duplicate key warnings when toggling filters
2) Keys/values normalize to String(id); fallback keys prefixed
3) Lists deduplicated by id before mapping

Implementation Tasks
- Add uniqueById helper and apply across lists
- Normalize keys/values to string ids
- Prefix fallback keys to avoid collisions

Output Style
- Minimal diff; targeted patches only
- Non-interactive commands

Validation
- Run: npm run dev
- Check: navigate to Quote page; toggle selects
- Console: no duplicate key warnings

Risks & Fallbacks
- Mixed id types; enforce String(id) normalization
- Fallback items missing; prefix keys to ensure uniqueness
```
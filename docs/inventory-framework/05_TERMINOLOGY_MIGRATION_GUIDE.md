# Terminology Migration Guide: AMRO-Specific to Domain-Agnostic

## Purpose
This guide documents terminology and structure changes made during genericization of inventory technical documentation.

## Migration Principles
- Preserve intent and technical accuracy.
- Move domain-specific terminology to extension sections.
- Keep generic core free of domain-locked nouns and assumptions.

## Terminology Mapping Table
| Legacy AMRO Term | Generic Replacement | Notes |
|---|---|---|
| AMRO inventory | domain inventory | use AMRO only in extension sections |
| MRO item profile | item profile extension | can bind to maintenance domain attributes |
| work package | execution context | optional extension maps back to work package |
| task reserve/consume | reservation lifecycle action | task/work package linkage in extension metadata |
| ATA chapter | domain classification code | AMRO extension can define ATA specifically |
| serviceability risk | operational readiness risk | map to domain-specific risk taxonomies |
| line-side store | execution-adjacent location | domain extension may rename |
| aircraft component | serialized asset item | generic can represent any serialized asset |

## Documentation Structure Migration
| Legacy Pattern | New Pattern |
|---|---|
| Single AMRO-centric document | Dual-layer format (`🟦 Generic`, `🟧 Extension`) |
| Hard-coded table names in core narrative | Placeholder-based schema references |
| AMRO workflow as universal workflow | Generic base workflow + domain workflow binding |
| AMRO API routes as baseline contract | Canonical inventory contracts + domain adapter routes |

## Change Log Summary
- Replaced hard-coded references with placeholders:
  - `public.uim_mro_item_profiles` -> `${item_profile_table}`
  - `public.parts_inventory` -> `${legacy_domain_inventory_table}` (migration context)
  - `public.uim_inventory_ledger` -> `${inventory_ledger_table}`
- Converted AMRO-first narrative to generic-first narrative.
- Added adaptation and validation toolkits for non-AMRO domains.

## Impacted Concepts and Their New IDs
| Concept ID | Generic Concept |
|---|---|
| `INV-CORE-001` | catalog item definition |
| `INV-CORE-002` | inventory state model |
| `INV-CORE-003` | immutable movement ledger |
| `INV-CORE-004` | reservation lifecycle |
| `INV-CORE-005` | projection and reconciliation |
| `INV-INT-001` | domain adapter command flow |
| `INV-VAL-001` | cross-domain neutrality validation |

## Migration Checklist for Maintainers
- [ ] Replace domain names in base sections.
- [ ] Move domain-only details to extension appendices.
- [ ] Replace concrete schema names with placeholders in core examples.
- [ ] Add domain binding table in extension docs.
- [ ] Validate with cross-domain checklist before publish.

## Backward Compatibility Notes
- AMRO implementation references remain available in extension-bound documents.
- Existing AMRO integration contracts remain supported through domain adapter mapping.
- No runtime schema change is implied by terminology migration alone.

# MPD To task_templates Mapping

This document defines the transformation layer used by the MPD management module.
The frontend uses MPD language, while persistence is backed by `public.task_templates`.

## Field Mapping

| Frontend MPD Field | Backend task_templates Column | Notes |
| --- | --- | --- |
| `id` | `id` | UUID primary key |
| `mpd_sequence` | `tt_sequence` (fallback: `task_template_id`) | Human-readable sequence value |
| `mpd_code` | `code_form_no` | MPD code/form identifier |
| `ata_code` | `ata_code` | ATA chapter code |
| `reference_amp` | `reference_amp` | Reference AMP text |
| `description` | `description` | Required for create |
| `category_code` | `category_code` | Category lookup code |
| `estimated_man_hours` | `estimated_man_hours` | Decimal hours |
| `revision_status` | `revision_status` | Revision marker |
| `interval_hours` | `interval_hours` | Integer interval |
| `interval_cycles` | `interval_cycles` | Integer interval |
| `interval_months` | `interval_months` | Integer interval |
| `is_mandatory` | `is_mandatory` | Boolean |
| `assembly_model_id` | `assembly_models` (fallback: `model_id`) | UUID FK to model scope |
| `task_template_detail_json` | `task_template_detail_json` | JSON array |
| `task_template_scope_json` | `task_template_scope_json` | JSON array |
| `created_at` | `created_at` | Timestamp |
| `updated_at` | `updated_at` | Timestamp (if available) |

## Compatibility Rules

- Use `tt_sequence`; fallback to `task_template_id` when `tt_sequence` is unavailable.
- Use `assembly_models`; fallback to `model_id` when `assembly_models` is unavailable.
- Keep API contracts additive and return MPD field names consistently, regardless of backend column fallback.

## Validation Rules

- Create requires `ata_code` and `description`.
- Interval values and `estimated_man_hours` must be non-negative numbers when provided.
- `assembly_model_id` must be a valid UUID when provided.

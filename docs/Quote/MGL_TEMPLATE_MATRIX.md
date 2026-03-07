# MGL Template Matrix Configuration

## Overview
The MGL Main Template now supports a `detailed_matrix_rate_table` section for displaying complex rate options in a matrix format. This is essential for multi-modal and multi-option quotations.

## Configuration
Add the following section to your template's `sections` array:

```json
{
  "type": "detailed_matrix_rate_table",
  "height": 300,
  "page_break_before": false,
  "config": {
      "show_total": true,
      "group_by": ["carrier", "transit_time", "frequency"]
  },
  "content": {
      "text": "Freight Rates Breakdown"
  }
}
```

## Features
- **Grouping**: Automatically groups options by Carrier, Transit Time, and Frequency.
- **Dynamic Columns**: Generates columns for each unique container type/size found in the options.
- **Charge Breakdown**: Lists all charges (Ocean Freight, Trucking, etc.) as rows.
- **Zero Values**: Correctly displays `0.00` for charges that are applicable but free (e.g., specific waivers).
- **Remarks**: Displays charge-level notes in a dedicated column.

## Data Requirements
The renderer expects `options` in the quote context to have:
- `carrier`
- `transit_time`
- `frequency`
- `container_size` or `container_type`
- `charges` array with `desc` (or `description`), `total` (or `amount`), and `curr`.

## Migration
Run `supabase/migrations/20260307140000_fix_mgl_template_matrix.sql` to update the default MGL Main Template.

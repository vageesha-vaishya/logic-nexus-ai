# UIM Forms Usage Notes

## Create Mode

- Do not pass `existingEntity`.
- Submit button label is `Create`.
- Adapter issues `POST`.

## Edit Mode

- Pass `existingEntity` with a stable `id`.
- Submit button label switches to `Update`.
- Adapter issues `PATCH`.

## Validation Lifecycle

- Validation triggers on blur.
- Fields re-validate on change.
- Top-level summary banner uses `aria-live="assertive"` to prioritize screen-reader announcements.

## Reusable Sub-Blocks

- `AddressBlock`: used by Location Registry.
- `DimensionBlock`: used by Item Master.

Both blocks are reusable in any external form without modification.

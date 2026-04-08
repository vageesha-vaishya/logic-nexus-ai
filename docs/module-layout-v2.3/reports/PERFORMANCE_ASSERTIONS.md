# Performance Assertions (Phase 5.3)

## Lighthouse CI Gate
Target:
- LCP < 1.5s (3G throttle)
- CLS < 0.1
- INP/FID proxy <= 100ms for primary interactions

## Example CI Command Sequence
```bash
npm run storybook -- --port 6006
npx lhci autorun --collect.url=http://localhost:6006/?path=/story/amro-templates-amroinventorydatagridtemplate--desktop1366validation
```

## Runtime UI Performance Budgets
- Grid render (10k rows virtualized): < 120ms target.
- Scroll handler debounce: 120ms.
- Event panel append budget: <= 8ms per event in UI thread.
- Max memory (tab): <= 150MB.

## Observability Metrics
- `ui_grid_render_duration_ms`
- `ui_event_stream_append_duration_ms`
- `ui_viewport_checklist_recompute_ms`
- `ui_panel_restore_interaction_count`

## Current Engineering Baseline
- virtualized rendering and memoized callbacks implemented.
- panel collapse/restore transitions bounded and keyboard-safe.
- no horizontal overflow in detail content at validation viewport target.

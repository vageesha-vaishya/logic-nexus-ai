-- Phase 6 Step 64 — amro.work_order.parts_consumed outbox emitter.
--
-- Implements ADR-0013 step 4: replace the legacy
-- public.amro_uim_inventory_sync_events polling table with an
-- outbox-driven cross-module event. UIM consumes the event and
-- adjusts uim.stock_ledger_transactions.
--
-- Trigger fires when amro.work_order_materials.status transitions to
-- 'installed'. The material_status domain enumerates {pending, ordered,
-- received, installed, cancelled, returned}; 'installed' is AMRO's
-- canonical "this part was used on the aircraft" state, which is the
-- semantic equivalent of "consumed" (the abstract saga event name
-- ADR-0013 specified). The trigger lives at the AMRO vocabulary
-- level (status='installed'); the cross-module event_type stays
-- 'amro.work_order.parts_consumed' (the saga vocabulary) — the
-- mapping is intentional so the UIM consumer doesn't depend on
-- AMRO's internal status taxonomy.
--
-- Note: amro.work_order_materials is a Step 58 mirror of
-- public.amro_work_order_materials. Today writes go to public.* and
-- dual-write fires INSERT on amro.*. UPDATE OF status on public →
-- DELETE+INSERT on amro → triggers' AFTER INSERT branch fires. So
-- whether the application writes status='consumed' to public or
-- amro side, this emit fires once per terminal transition. After
-- Step 66's public.* drop, amro.* becomes canonical and the trigger
-- works without rewiring.
--
-- Generated via core.gen_emit_trigger (Step 55 codegen). Spec is
-- 12 lines instead of the ~70-line hand-written trigger fn this
-- replaces.

SELECT core.gen_emit_trigger(jsonb_build_object(
  'trigger_name',      'trg_amro_work_order_materials_emit_consumed',
  'function_name',     'amro.emit_work_order_parts_consumed',
  'source_table',      'amro.work_order_materials',
  'transition_column', 'status',
  'terminal_value',    'installed',
  'emit_to',           'outbox',
  'module',            'amro',
  'entity_type',       'work_order_material',
  'event_type',        'amro.work_order.parts_consumed',
  'payload_cols', jsonb_build_array(
    'id',
    'work_order_id',
    'part_number',
    'description',
    'manufacturer',
    'component_id',
    'quantity',
    'unit_of_measure',
    'unit_cost',
    'total_cost',
    'currency',
    'batch_lot_number',
    'material_certification',
    'is_critical'
  )
));

-- Extend v_cross_module_pending_events to expose the new event_type
-- so UIM's future consumer (Step 65 / separate slice) can poll for it
-- alongside the existing 8 saga event types.

CREATE OR REPLACE VIEW core.v_cross_module_pending_events AS
SELECT o.id, o.tenant_id, o.module, o.event_type, o.entity_id,
       o.occurred_at, o.version, o.payload, o.metadata
FROM core.outbox o
LEFT JOIN core.outbox_retries r ON r.outbox_id = o.id
WHERE o.published_at IS NULL
  AND o.event_type IN (
    -- Phase 5 finance chains
    'sales.opportunity.won',
    'logistics.shipment.delivered',
    -- Phase 6 compliance gating chains
    'sales.lead.created',
    'quotation.quote.send_requested',
    'logistics.booking.created',
    'finance.payment.created',
    -- Phase 6 CRM → comms suppression bridge
    'crm.do_not_contact.set',
    'crm.do_not_contact.cleared',
    -- Phase 6 ADR-0013 — AMRO → UIM inventory flow
    'amro.work_order.parts_consumed'
  )
  AND (r.id IS NULL OR (r.status = 'pending' AND r.next_attempt_at <= now()))
ORDER BY o.occurred_at;

COMMENT ON VIEW core.v_cross_module_pending_events IS
  'Unpublished cross-module events ready for consumer pickup. Phase 6 Step 64 added amro.work_order.parts_consumed alongside the finance + gating + CRM-comms chains.';

GRANT SELECT ON core.v_cross_module_pending_events TO service_role;

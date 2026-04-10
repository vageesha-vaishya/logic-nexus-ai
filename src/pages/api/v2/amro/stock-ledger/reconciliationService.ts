type SupabaseAdmin = {
  from: (table: string) => any;
};

export type ReconciliationExecutionResult = {
  runId: string;
  inspectedItems: number;
  varianceItems: number;
};

export async function executeStockLedgerReconciliationRun(input: {
  supabase: SupabaseAdmin;
  tenantId: string;
  franchiseId: string | null;
  userId: string;
  parameters: Record<string, unknown>;
}): Promise<ReconciliationExecutionResult> {
  const { supabase, tenantId, franchiseId, userId, parameters } = input;
  const { data: run, error: runError } = await supabase
    .from('amro_stock_reconciliation_runs')
    .insert({
      tenant_id: tenantId,
      franchise_id: franchiseId,
      run_status: 'running',
      requested_by: userId,
      started_at: new Date().toISOString(),
      parameters,
    })
    .select('id')
    .limit(1)
    .maybeSingle();
  if (runError || !run?.id) {
    throw new Error(`Failed to initialize reconciliation run: ${runError?.message || 'unknown error'}`);
  }
  const runId = String(run.id);

  const { data: balances, error: balanceError } = await supabase
    .from('amro_stock_balance_summary')
    .select('tenant_id,part_inventory_id,current_on_hand,ledger_net_quantity')
    .eq('tenant_id', tenantId);

  if (balanceError) {
    await supabase
      .from('amro_stock_reconciliation_runs')
      .update({
        run_status: 'failed',
        completed_at: new Date().toISOString(),
        summary: { error: balanceError.message },
      })
      .eq('tenant_id', tenantId)
      .eq('id', runId);
    throw new Error(`Failed to evaluate balances: ${balanceError.message}`);
  }

  const varianceRows = (balances || [])
    .map((row: Record<string, unknown>) => {
      const expected = Number(row.ledger_net_quantity || 0);
      const actual = Number(row.current_on_hand || 0);
      const variance = actual - expected;
      return {
        tenant_id: tenantId,
        run_id: runId,
        part_inventory_id: String(row.part_inventory_id || ''),
        expected_quantity: expected,
        actual_quantity: actual,
        variance_quantity: variance,
        variance_cost: 0,
        variance_reason: Math.abs(variance) > 0 ? 'ledger_balance_mismatch' : null,
        metadata: {},
      };
    })
    .filter((row) => row.part_inventory_id);

  if (varianceRows.length > 0) {
    await supabase.from('amro_stock_reconciliation_items').insert(varianceRows);
  }
  const varianceCount = varianceRows.filter((row) => Math.abs(row.variance_quantity) > 0).length;

  await supabase
    .from('amro_stock_reconciliation_runs')
    .update({
      run_status: 'completed',
      completed_at: new Date().toISOString(),
      summary: {
        inspected_items: varianceRows.length,
        variance_items: varianceCount,
      },
    })
    .eq('tenant_id', tenantId)
    .eq('id', runId);

  return {
    runId,
    inspectedItems: varianceRows.length,
    varianceItems: varianceCount,
  };
}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AssignmentRule {
  id: string;
  assignment_type: string;
  assigned_to: string | null;
  territory_id: string | null;
  max_leads_per_user: number | null;
  criteria: any;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting lead assignment processing...');

    // Get pending queue items
    const { data: queueItems, error: queueError } = await supabase
      .from('lead_assignment_queue')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(50);

    if (queueError) throw queueError;

    if (!queueItems || queueItems.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending assignments', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`Processing ${queueItems.length} queue items...`);

    let successCount = 0;
    let failCount = 0;

    for (const queueItem of queueItems) {
      try {
        // Mark as processing
        await supabase
          .from('lead_assignment_queue')
          .update({ status: 'processing' })
          .eq('id', queueItem.id);

        // Get lead details
        const { data: lead } = await supabase
          .from('leads')
          .select('*')
          .eq('id', queueItem.lead_id)
          .single();

        if (!lead) {
          throw new Error('Lead not found');
        }

        // Get applicable assignment rules
        const { data: rules, error: rulesError } = await supabase
          .from('lead_assignment_rules')
          .select('*')
          .eq('tenant_id', queueItem.tenant_id)
          .eq('is_active', true)
          .order('priority', { ascending: false });

        if (rulesError) throw rulesError;

        let assignedUserId: string | null = null;
        let assignmentMethod = 'manual';
        let ruleId: string | null = null;

        // Try to find matching rule
        for (const rule of rules || []) {
          const matchesCriteria = evaluateCriteria(lead, rule.criteria);
          
          if (matchesCriteria) {
            assignedUserId = await determineAssignee(supabase, rule, queueItem.tenant_id);
            assignmentMethod = rule.assignment_type;
            ruleId = rule.id;
            break;
          }
        }

        // Fallback to round robin if no rule matched
        if (!assignedUserId) {
          assignedUserId = await roundRobinAssignment(supabase, queueItem.tenant_id);
          assignmentMethod = 'round_robin';
        }

        if (assignedUserId) {
          // Update lead owner
          await supabase
            .from('leads')
            .update({ owner_id: assignedUserId })
            .eq('id', queueItem.lead_id);

          // Record assignment history
          await supabase.from('lead_assignment_history').insert({
            lead_id: queueItem.lead_id,
            assigned_to: assignedUserId,
            assignment_method: assignmentMethod,
            rule_id: ruleId,
            tenant_id: queueItem.tenant_id,
            franchise_id: queueItem.franchise_id,
            assigned_by: null, // automated
          });

          // Update user capacity
          await supabase.rpc('increment_user_lead_count', {
            p_user_id: assignedUserId,
            p_tenant_id: queueItem.tenant_id
          });

          // Mark queue item as assigned
          await supabase
            .from('lead_assignment_queue')
            .update({ status: 'assigned', processed_at: new Date().toISOString() })
            .eq('id', queueItem.id);

          successCount++;
          console.log(`Assigned lead ${queueItem.lead_id} to user ${assignedUserId}`);
        } else {
          throw new Error('No available user found for assignment');
        }
      } catch (error: any) {
        console.error(`Failed to process queue item ${queueItem.id}:`, error);
        
        // Update queue item with error
        await supabase
          .from('lead_assignment_queue')
          .update({
            status: 'failed',
            error_message: error.message,
            retry_count: (queueItem.retry_count || 0) + 1,
          })
          .eq('id', queueItem.id);

        failCount++;
      }
    }

    console.log(`Processing complete: ${successCount} succeeded, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        message: 'Queue processing complete',
        processed: queueItems.length,
        succeeded: successCount,
        failed: failCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('Error processing assignments:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

function evaluateCriteria(lead: any, criteria: any): boolean {
  if (!criteria || Object.keys(criteria).length === 0) return true;

  for (const [key, value] of Object.entries(criteria)) {
    if (lead[key] !== value) return false;
  }
  return true;
}

async function determineAssignee(
  supabase: any,
  rule: AssignmentRule,
  tenantId: string
): Promise<string | null> {
  switch (rule.assignment_type) {
    case 'specific_user':
      return rule.assigned_to;

    case 'round_robin':
      return await roundRobinAssignment(supabase, tenantId);

    case 'load_balance':
      return await loadBalanceAssignment(supabase, tenantId, rule.max_leads_per_user);

    case 'territory':
      if (rule.territory_id) {
        return await territoryAssignment(supabase, rule.territory_id);
      }
      return null;

    default:
      return null;
  }
}

async function roundRobinAssignment(supabase: any, tenantId: string): Promise<string | null> {
  const { data: capacities } = await supabase
    .from('user_capacity')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .eq('is_available', true)
    .order('last_assigned_at', { ascending: true, nullsFirst: true })
    .limit(1);

  return capacities?.[0]?.user_id || null;
}

async function loadBalanceAssignment(
  supabase: any,
  tenantId: string,
  maxLeads?: number | null
): Promise<string | null> {
  let query = supabase
    .from('user_capacity')
    .select('user_id, current_leads, max_leads')
    .eq('tenant_id', tenantId)
    .eq('is_available', true);

  if (maxLeads) {
    query = query.lt('current_leads', maxLeads);
  }

  const { data: capacities } = await query.order('current_leads', { ascending: true }).limit(1);

  return capacities?.[0]?.user_id || null;
}

async function territoryAssignment(supabase: any, territoryId: string): Promise<string | null> {
  const { data: assignments } = await supabase
    .from('territory_assignments')
    .select('user_id')
    .eq('territory_id', territoryId)
    .eq('is_primary', true)
    .limit(1);

  return assignments?.[0]?.user_id || null;
}

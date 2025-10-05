// Ambient Deno typing for editors without Deno type support
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;
// @ts-ignore Supabase Edge (Deno) resolves URL imports at runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

          // Auto-link unlinked tasks assigned to this user within the same scope (best-effort)
          try {
            let linkQuery = supabase
              .from('activities')
              .update({ lead_id: queueItem.lead_id })
              .eq('assigned_to', assignedUserId)
              .is('lead_id', null)
              .eq('activity_type', 'task')
              .eq('tenant_id', queueItem.tenant_id);

            if (queueItem.franchise_id) {
              linkQuery = linkQuery.eq('franchise_id', queueItem.franchise_id);
            }

            const { error: linkErr } = await linkQuery;
            if (linkErr) {
              console.warn('Auto-link tasks skipped:', linkErr.message || linkErr);
            }
          } catch (linkErr: any) {
            console.warn('Auto-link tasks skipped:', linkErr?.message || linkErr);
          }

          // Notify assigned user via email (best-effort, non-blocking)
          try {
            // Get assigned user profile for email
            const { data: profile, error: profileErr } = await supabase
              .from('profiles')
              .select('id, email, first_name, last_name')
              .eq('id', assignedUserId)
              .single();

            if (profileErr) throw profileErr;
            if (!profile?.email) throw new Error('Assigned user has no email');

            // Pick a tenant/franchise email account to send from
            let accountQuery = supabase
              .from('email_accounts')
              .select('id, email_address, is_primary')
              .eq('is_active', true)
              .limit(1);

            if (queueItem.franchise_id) {
              accountQuery = accountQuery.eq('franchise_id', queueItem.franchise_id);
            } else if (queueItem.tenant_id) {
              accountQuery = accountQuery.eq('tenant_id', queueItem.tenant_id);
            }

            const { data: emailAccount, error: acctErr } = await accountQuery.single();
            if (acctErr) throw acctErr;
            if (!emailAccount?.id) throw new Error('No active email account configured');

            const subject = `New Lead Assigned: ${lead.first_name} ${lead.last_name}`;
            const appBaseUrl = Deno.env.get('APP_BASE_URL') || '';
            const displayName = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
            const bodyHtml = `
              <p>Hi ${displayName},</p>
              <p>You have been assigned a new lead:</p>
              <ul>
                <li><strong>Name:</strong> ${lead.first_name} ${lead.last_name}</li>
                ${lead.company ? `<li><strong>Company:</strong> ${lead.company}</li>` : ''}
                ${lead.email ? `<li><strong>Email:</strong> ${lead.email}</li>` : ''}
                ${lead.phone ? `<li><strong>Phone:</strong> ${lead.phone}</li>` : ''}
                <li><strong>Status:</strong> ${lead.status}</li>
              </ul>
              <p><a href="${appBaseUrl}/dashboard/leads/${queueItem.lead_id}">View Lead</a></p>
            `;

            // Invoke send-email function via Functions endpoint using service role
            const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
            const functionsUrl = `${supabaseUrl}/functions/v1/send-email`;
            const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

            const resp = await fetch(functionsUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${serviceKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                accountId: emailAccount.id,
                to: [profile.email],
                cc: [],
                subject,
                body: bodyHtml
              })
            });

            if (!resp.ok) {
              const txt = await resp.text();
              console.warn('Failed to send assignment email:', resp.status, txt);
            }
          } catch (notifyErr) {
            console.warn('Assignment email skipped:', notifyErr?.message || notifyErr);
          }

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

// Ambient Deno typing for editors without Deno type support
declare const Deno: any;

import { Logger, serveWithLogger } from '../_shared/logger.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';

interface AssignmentRule {
  id: string;
  assignment_type: string;
  assigned_to: string | null;
  territory_id: string | null;
  max_leads_per_user: number | null;
  criteria: any;
}

// Helper to evaluate criteria (simplified for brevity)
function evaluateCriteria(lead: any, criteria: any): boolean {
  if (!criteria) return true;
  // Implement logic to check if lead matches criteria
  // Example: criteria = { source: 'web', min_score: 50 }
  for (const key in criteria) {
    if (lead[key] !== criteria[key]) return false;
  }
  return true;
}

serveWithLogger(async (req, logger, supabase) => {
  const headers = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  // Auth: verify service role key or authenticated user (admin manually triggering)
  const authHeader = req.headers.get('Authorization');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!authHeader || !authHeader.includes(serviceKey)) {
    const { user, error: authError } = await requireAuth(req);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } });
    }
  }

  try {
    logger.info('Starting lead assignment processing...');

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
        { headers: { ...headers, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    logger.info(`Processing ${queueItems.length} queue items...`);

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
             ruleId = rule.id;
             if (rule.assignment_type === 'direct' && rule.assigned_to) {
                 assignedUserId = rule.assigned_to;
                 assignmentMethod = 'rule_direct';
                 break;
             } else if (rule.assignment_type === 'round_robin' && rule.territory_id) {
                 // Implement round robin logic here
                 // For now, just pick first user in territory (placeholder)
                 const { data: territoryUsers } = await supabase
                    .from('territory_assignments')
                    .select('user_id')
                    .eq('territory_id', rule.territory_id)
                    .limit(1);
                 
                 if (territoryUsers && territoryUsers.length > 0) {
                     assignedUserId = territoryUsers[0].user_id;
                     assignmentMethod = 'rule_round_robin';
                     break;
                 }
             }
          }
        }

        // If no rule matched, assign to default user or leave unassigned
        if (!assignedUserId) {
            // Check for default assignment rule?
            // For now, leave unassigned
            assignmentMethod = 'unassigned';
        }

        if (assignedUserId) {
             // Assign lead
             await supabase.from('leads').update({ owner_id: assignedUserId, status: 'new' }).eq('id', lead.id);
             
             // Create notification
             await supabase.from('notifications').insert({
                 user_id: assignedUserId,
                 title: 'New Lead Assigned',
                 message: `Lead ${lead.first_name} ${lead.last_name} has been assigned to you.`,
                 type: 'lead_assignment',
                 reference_id: lead.id
             });
        }

        // Update Queue
        await supabase.from('lead_assignment_queue').update({
            status: 'completed',
            assigned_to: assignedUserId,
            rule_id: ruleId,
            processed_at: new Date().toISOString()
        }).eq('id', queueItem.id);
        
        // Log history
        await supabase.from('lead_assignment_history').insert({
            lead_id: lead.id,
            previous_owner_id: lead.owner_id, // assuming we had it
            new_owner_id: assignedUserId,
            assignment_method: assignmentMethod,
            rule_id: ruleId
        });

        successCount++;

      } catch (err: any) {
        failCount++;
        logger.error(`Error processing queue item ${queueItem.id}:`, { error: err });
        
        await supabase.from('lead_assignment_queue').update({
            status: 'failed',
            error_message: err.message,
            processed_at: new Date().toISOString()
        }).eq('id', queueItem.id);
      }
    }

    return new Response(
      JSON.stringify({ 
          success: true, 
          processed: queueItems.length, 
          successCount, 
          failCount 
      }),
      { headers: { ...headers, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    logger.error("Lead Assignment Processor Error:", { error: error });
    return new Response(JSON.stringify({ error: error.message || String(error) }), { 
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" } 
    });
  }
}, "process-lead-assignments");
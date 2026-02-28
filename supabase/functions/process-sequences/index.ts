import { serveWithLogger } from "../_shared/logger.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

declare const Deno: any;

serveWithLogger(async (req, logger, supabase) => {
  const headers = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers });

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
    // 1. Get Due Steps
    const { data: dueSteps, error: fetchError } = await supabase.rpc('get_due_sequence_steps', { p_batch_size: 50 });
    
    if (fetchError) throw fetchError;
    if (!dueSteps || dueSteps.length === 0) {
        return new Response(JSON.stringify({ message: "No active sequences due." }), { headers: { ...headers, "Content-Type": "application/json" } });
    }

    const results = [];

    // 2. Process Each
    for (const item of dueSteps) {
        let success = false;
        let errorMsg = null;

        try {
            // A. Execute Step
            if (item.step_type === 'email' && item.template_id) {
                // Fetch Template
                const { data: template } = await supabase.from('email_templates').select('*').eq('id', item.template_id).single();
                
                if (template) {
                    // Send Email
                    // We use invoke('send-email') to leverage existing logic (tracking, etc.)
                    const { error: sendError } = await supabase.functions.invoke('send-email', {
                        body: {
                            to: [item.recipient_email],
                            subject: template.subject, // Should interpolate variables here in future
                            html: template.body, // Should interpolate variables
                            tenant_id: item.tenant_id,
                            tracking: true
                        }
                    });

                    if (sendError) throw new Error("Failed to send email: " + JSON.stringify(sendError));
                    success = true;
                } else {
                    throw new Error("Template not found");
                }
            } else if (item.step_type === 'task') {
                // Create Task (Placeholder)
                // await supabase.from('tasks').insert({ ... })
                success = true;
            }

        } catch (err: any) {
            errorMsg = err.message;
            logger.error(`Error processing sequence ${item.sequence_id} step ${item.step_order} for ${item.recipient_email}:`, { error: err });
        }

        // B. Update State
        if (success) {
            // Find Next Step to calculate delay
            const { data: nextStep } = await supabase
                .from('email_sequence_steps')
                .select('delay_hours')
                .eq('sequence_id', item.sequence_id)
                .eq('step_order', item.step_order + 1)
                .single();

            const now = new Date();
            const updates: any = {
                current_step_order: item.step_order,
                last_step_completed_at: now.toISOString(),
            };

            if (nextStep) {
                // Schedule next
                const nextRun = new Date(now.getTime() + (nextStep.delay_hours * 60 * 60 * 1000));
                updates.next_step_due_at = nextRun.toISOString();
            } else {
                // Complete
                updates.status = 'completed';
                updates.next_step_due_at = null;
            }

            await supabase.from('email_sequence_enrollments').update(updates).eq('id', item.enrollment_id);
            
            // Log
            await supabase.from('email_sequence_logs').insert({
                enrollment_id: item.enrollment_id,
                step_order: item.step_order,
                action: 'sent',
                details: { template_id: item.template_id }
            });

        } else {
            // Retry logic or fail
             await supabase.from('email_sequence_enrollments').update({
                status: 'paused', // Pause on error
                // error_message: errorMsg
            }).eq('id', item.enrollment_id);
             
             // Log error
            await supabase.from('email_sequence_logs').insert({
                enrollment_id: item.enrollment_id,
                step_order: item.step_order,
                action: 'failed',
                details: { error: errorMsg }
            });
        }
        
        results.push({ id: item.enrollment_id, success });
    }

    return new Response(JSON.stringify(results), { 
      headers: { ...headers, "Content-Type": "application/json" } 
    });

  } catch (error: any) {
    logger.error("Sequence Processor Error:", { error: error });
    return new Response(JSON.stringify({ error: error.message || String(error) }), { 
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" } 
    });
  }
}, "process-sequences");
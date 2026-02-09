
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const headers = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

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
            console.error(`Error processing sequence ${item.sequence_id} step ${item.step_order} for ${item.recipient_email}:`, err);
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
            // Log Failure
             await supabase.from('email_sequence_logs').insert({
                enrollment_id: item.enrollment_id,
                step_order: item.step_order,
                action: 'failed',
                details: { error: errorMsg }
            });
            
            // Optionally pause enrollment on error?
            // await supabase.from('email_sequence_enrollments').update({ status: 'paused' }).eq('id', item.enrollment_id);
        }
        
        results.push({ enrollment: item.enrollment_id, success, error: errorMsg });
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, details: results }),
      { headers: { ...headers, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
});

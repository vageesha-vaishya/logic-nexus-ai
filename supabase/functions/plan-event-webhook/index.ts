declare const Deno: any;
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.22.4';
import { corsHeaders } from '../_shared/cors.ts';
import { Logger } from '../_shared/logger.ts';

const PlanChangeEventSchema = z.object({
  plan_id: z.string().uuid(),
  event_type: z.enum(['created', 'updated', 'deleted', 'status_changed']),
  changes: z.record(z.string(), z.any()).optional(),
  user_id: z.string().uuid().optional(),
  timestamp: z.string().datetime().optional()
});

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const logger = new Logger({ function: 'plan-event-webhook' });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const validation = PlanChangeEventSchema.safeParse(body);

    if (!validation.success) {
      logger.warn('Invalid payload format', { error: validation.error });
      return new Response(
        JSON.stringify({ error: validation.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { plan_id, event_type, changes, user_id, timestamp } = validation.data;
    const eventTime = timestamp || new Date().toISOString();

    logger.info(`Processing plan event: ${event_type}`, { plan_id, event_type, user_id });

    // 1. Fetch plan details (unless deleted)
    let planDetails = null;
    if (event_type !== 'deleted') {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', plan_id)
        .single();
      
      if (error) {
        logger.error('Failed to fetch plan details', { error: String(error) });
      } else {
        planDetails = data;
      }
    }

    // 2. Logic to dispatch to external systems
    // In a real implementation, we would fetch registered webhooks from a table
    // e.g., SELECT * FROM webhook_endpoints WHERE event_type = 'plan_change'
    
    // For now, we'll check if the plan metadata has any specific webhook directives
    const metadata = planDetails?.metadata as Record<string, any> | null;
    if (metadata?.webhook_url) {
      try {
        logger.info(`Dispatching to configured webhook: ${metadata.webhook_url}`);
        // await fetch(metadata.webhook_url, {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({
        //     event: 'plan_change',
        //     type: event_type,
        //     data: planDetails,
        //     changes,
        //     timestamp: eventTime
        //   })
        // });
      } catch (err) {
        logger.error('Failed to dispatch webhook', { error: String(err) });
      }
    }

    // 3. Log to audit_logs if needed
    // (Assuming the main application handles the primary audit log, 
    // but this function could log the "Notification" event)
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Event processed', 
        plan_id,
        timestamp: eventTime 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Internal server error', { error: message });
    
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

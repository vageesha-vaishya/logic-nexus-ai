declare const Deno: any;
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.22.4';
import { getCorsHeaders } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';
import { Logger } from '../_shared/logger.ts';

const LeadEventSchema = z.object({
  lead_id: z.string().uuid(),
  type: z.enum(['email_opened', 'link_clicked', 'page_view', 'form_submission']),
  metadata: z.record(z.string(), z.any()).optional(),
  timestamp: z.string().datetime().optional()
});

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Auth: require authenticated user
  const { user, error: authError } = await requireAuth(req);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const logger = new Logger({ function: 'lead-event-webhook' });

  const WebIntakeSchema = z.object({
    tenant_id: z.string().uuid(),
    franchise_id: z.string().uuid().optional(),
    first_name: z.string().trim().min(1),
    last_name: z.string().trim().min(1),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    company: z.string().optional(),
    title: z.string().optional(),
    estimated_value: z.number().optional(),
    expected_close_date: z.string().optional(),
    description: z.string().optional(),
    notes: z.string().optional(),
    source: z.enum(['website', 'chatbot', 'referral', 'email', 'phone', 'social', 'event', 'other']).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
    mode: z.enum(['web_form', 'chatbot']).optional()
  }).refine((data: any) => !!(data.email?.trim() || data.phone?.trim()), {
    path: ['email'],
    message: 'Provide at least one contact: email or phone'
  });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();

    const asEvent = LeadEventSchema.safeParse(body);
    if (asEvent.success) {
      const { lead_id, type, metadata, timestamp } = asEvent.data;

      const { error: insertError } = await supabase
        .from('lead_activities')
        .insert({
          lead_id,
          type,
          metadata: metadata || {},
          created_at: timestamp || new Date().toISOString()
        });

      if (insertError) throw insertError;

      await supabase
        .from('leads')
        .update({ last_activity_date: new Date().toISOString() })
        .eq('id', lead_id);

      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\./)?.[1];
        const functionsUrl = projectRef 
          ? `https://${projectRef}.supabase.co/functions/v1` 
          : 'http://localhost:54321/functions/v1';

        await fetch(`${functionsUrl}/calculate-lead-score`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ lead_id })
        });
      } catch (err) {
        logger.warn('Failed to trigger score calculation', { error: String(err) });
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Event recorded', lead_id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const asIntake = WebIntakeSchema.safeParse(body);
    if (!asIntake.success) {
      return new Response(
        JSON.stringify({ error: asIntake.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const {
      tenant_id,
      franchise_id,
      first_name,
      last_name,
      email,
      phone,
      company,
      title,
      estimated_value,
      expected_close_date,
      description,
      notes,
      source,
      metadata,
      mode
    } = asIntake.data;

    const intakeSource = source || (mode === 'chatbot' ? 'chatbot' : 'website');

    let leadId: string | null = null;
    try {
      let query = supabase
        .from('leads')
        .select('id,email,phone')
        .eq('tenant_id', tenant_id)
        .limit(1);
      if (franchise_id) {
        query = query.eq('franchise_id', franchise_id);
      }
      const ors: string[] = [];
      if (email) ors.push(`email.eq.${email}`);
      if (phone) ors.push(`phone.eq.${phone}`);
      if (ors.length) {
        query = query.or(ors.join(','));
      }
      const { data: existing, error: findErr } = await query.maybeSingle();
      if (findErr) throw findErr;

      if (existing?.id) {
        const updatePayload: Record<string, any> = {
          first_name,
          last_name,
          source: intakeSource,
          updated_at: new Date().toISOString()
        };
        if (company) updatePayload.company = company;
        if (title) updatePayload.title = title;
        if (email) updatePayload.email = email;
        if (phone) updatePayload.phone = phone;
        if (estimated_value != null) updatePayload.estimated_value = estimated_value;
        if (expected_close_date) updatePayload.expected_close_date = expected_close_date;
        if (description) updatePayload.description = description;
        if (notes) updatePayload.notes = notes;

        const { error: updErr } = await supabase
          .from('leads')
          .update(updatePayload)
          .eq('id', existing.id);
        if (updErr) throw updErr;
        leadId = existing.id;
      } else {
        const insertPayload: Record<string, any> = {
          tenant_id,
          franchise_id: franchise_id || null,
          first_name,
          last_name,
          company: company || null,
          title: title || null,
          email: email || null,
          phone: phone || null,
          status: 'new',
          source: intakeSource,
          estimated_value: estimated_value ?? null,
          expected_close_date: expected_close_date || null,
          description: description || null,
          notes: notes || null
        };
        const { data: created, error: insErr } = await supabase
          .from('leads')
          .insert(insertPayload)
          .select('id')
          .single();
        if (insErr) throw insErr;
        leadId = created.id;
      }
    } catch (e: any) {
      logger.error('Lead upsert failed', { error: e?.message || String(e) });
      return new Response(
        JSON.stringify({ error: 'Lead upsert failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const activityType = mode === 'chatbot' || intakeSource === 'chatbot' ? 'chatbot_message' : 'form_submission';
    const { error: actErr } = await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        type: activityType,
        metadata: {
          source: intakeSource,
          ...(metadata || {})
        }
      });
    if (actErr) {
      logger.warn('Activity insert failed', { error: actErr.message || String(actErr) });
    }

    await supabase
      .from('leads')
      .update({ last_activity_date: new Date().toISOString() })
      .eq('id', leadId);

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\./)?.[1];
      const functionsUrl = projectRef 
        ? `https://${projectRef}.supabase.co/functions/v1` 
        : 'http://localhost:54321/functions/v1';
      await fetch(`${functionsUrl}/calculate-lead-score`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ lead_id: leadId })
      });
    } catch (err) {
      logger.warn('Score calculation trigger failed', { error: String(err) });
    }

    return new Response(
      JSON.stringify({ success: true, lead_id: leadId, source: intakeSource }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

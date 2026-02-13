import { createClient } from "@supabase/supabase-js";
import { Logger } from '../_shared/logger.ts';
import { normalizeGmailPayload, normalizeOutlookPayload, NormalizedEmail, correlateThread } from './utils.ts';
import { classifyEmailContent } from '../_shared/classification-logic.ts';
import { determineRoute } from '../_shared/routing-logic.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';
import { sanitizeForLLM } from "../_shared/pii-guard.ts";
import { pickEmbeddingModel } from "../_shared/model-router.ts";
import { logAiCall } from "../_shared/audit.ts";

declare const Deno: any;

const logger = new Logger(null, { component: "ingest-email" });

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: require authenticated user
  const { user, error: authError } = await requireAuth(req);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Content-Language": "en" },
      });
    }

    const payload = await req.json().catch(() => ({}));
    const provider = payload?.provider as string | undefined;

    if (!provider || (provider !== "gmail" && provider !== "outlook")) {
      return new Response(JSON.stringify({ error: "Invalid or missing provider" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Content-Language": "en" },
      });
    }

    logger.info(`Received email ingestion request for ${provider}`);

    let email: NormalizedEmail;
    try {
      if (provider === 'gmail') {
        email = normalizeGmailPayload(payload.data || payload);
      } else {
        email = normalizeOutlookPayload(payload.data || payload);
      }
    } catch (err: any) {
      logger.error("Failed to normalize email payload", { error: err });
      return new Response(JSON.stringify({ error: "Payload normalization failed: " + err.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Content-Language": "en" },
      });
    }

    // 1. Thread Correlation
    const lookupThread = async (msgId: string) => {
      const { data } = await supabase
        .from('emails')
        .select('id, conversation_id')
        .eq('message_id', msgId)
        .single();
      return data;
    };

    const { conversationId } = await correlateThread(email, lookupThread);

    // 1.5 Handle Attachments
    const attachmentsMeta: any[] = [];
    if (email.attachments && email.attachments.length > 0) {
      for (const att of email.attachments) {
        try {
          // Use conversationId/messageId prefix for organization
          const filePath = `${conversationId}/${email.messageId.replace(/[<>]/g, '')}/${att.filename}`;
          
          // Convert base64 to Uint8Array
          const binStr = atob(att.content);
          const len = binStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binStr.charCodeAt(i);
          }
          
          const { error: uploadError } = await supabase.storage
            .from('email-attachments')
            .upload(filePath, bytes, {
              contentType: att.contentType,
              upsert: true
            });

          if (uploadError) {
             logger.error(`Failed to upload attachment ${att.filename}`, { error: uploadError });
          } else {
             const { data: { publicUrl } } = supabase.storage
               .from('email-attachments')
               .getPublicUrl(filePath);
             
             attachmentsMeta.push({
               name: att.filename,
               size: att.size,
               type: att.contentType,
               url: publicUrl
             });
          }
        } catch (err) {
          logger.error(`Error processing attachment ${att.filename}`, { error: err });
        }
      }
    }

    // 1.8 Classification & Routing
    const classification = classifyEmailContent(email.subject, email.bodyText || email.bodyHtml || "");
    const routing = determineRoute({
      category: classification.category,
      sentiment: classification.sentiment,
      intent: classification.intent
    });

    // 2. Persist Email
    let accountId = payload.account_id;
    if (!accountId) {
       // Try to match 'To' field to a registered email account
       const recipientEmails = email.to.map(t => t.email);
       const { data: account } = await supabase
         .from('email_accounts')
         .select('id')
         .in('email_address', recipientEmails)
         .limit(1)
         .single();
       
       if (account) accountId = account.id;
    }

    if (!accountId) {
       logger.warn("No matching account_id found for incoming email. Storing without account association (might violate FK).");
       // Fallback for dev/test: use any account
       const { data: anyAccount } = await supabase.from('email_accounts').select('id').limit(1).single();
       if (anyAccount) accountId = anyAccount.id;
    }

    const { data: insertedEmail, error: insertError } = await supabase
      .from('emails')
      .insert({
        account_id: accountId,
        message_id: email.messageId,
        conversation_id: conversationId,
        subject: email.subject,
        body_html: email.bodyHtml,
        body_text: email.bodyText,
        from_email: email.from.email, 
        to_emails: email.to,
        cc_emails: email.cc,
        bcc_emails: email.bcc,
        in_reply_to: email.inReplyTo,
        email_references: email.references,
        received_at: email.receivedAt,
        raw_headers: email.headers,
        internet_message_id: email.messageId,
        ai_sentiment: classification.sentiment,
        ai_urgency: routing.sla_minutes <= 30 ? 'high' : 'medium',
        intent: classification.intent,
        category: classification.category,
        queue: routing.queue,
        attachments: attachmentsMeta,
        has_attachments: attachmentsMeta.length > 0
      })
      .select()
      .single();

    if (insertError) {
      logger.error("Failed to insert email", { error: insertError });
      throw insertError;
    }

    // 2.2 Embed email body for semantic search (if available)
    try {
      const bodyText = insertedEmail.body_text || insertedEmail.body_html || "";
      const { sanitized, redacted } = sanitizeForLLM(bodyText);
      if (sanitized && sanitized.length > 0) {
        const { model, url, headers } = pickEmbeddingModel();
        const embRes = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ input: sanitized, model }),
        });
        if (embRes.ok) {
          const embJson = await embRes.json();
          const embedding = embJson?.data?.[0]?.embedding;
          if (Array.isArray(embedding)) {
            const { error: updErr } = await supabase
              .from("emails")
              .update({ embedding })
              .eq("id", insertedEmail.id);
            if (updErr) {
              logger.warn("Failed to update email embedding", { error: updErr });
            } else {
              await logAiCall(supabase, {
                tenant_id: insertedEmail.tenant_id ?? null,
                user_id: user.id,
                function_name: "ingest-email-embed",
                model_used: model,
                output_summary: { redacted },
                pii_detected: redacted.length > 0,
                pii_fields_redacted: redacted,
              });
            }
          }
        } else {
          const t = await embRes.text();
          logger.warn("Embedding HTTP error", { text: t });
        }
      }
    } catch (embErr) {
      logger.warn("Embedding step failed", { error: embErr });
    }

    // 2.5 Insert Routing Event
    if (routing.queue) {
      const { error: routeError } = await supabase
        .from('routing_events')
        .insert({
          email_id: insertedEmail.id,
          queue: routing.queue,
          sla_minutes: routing.sla_minutes,
          metadata: {
            category: classification.category,
            sentiment: classification.sentiment,
            intent: classification.intent
          }
        });
        
      if (routeError) {
        logger.error("Failed to insert routing event", { error: routeError });
        // Don't fail the whole request, just log
      }
    }

    logger.info(`Successfully ingested email ${insertedEmail.id}`);

    return new Response(JSON.stringify({
      status: "success",
      id: insertedEmail.id,
      conversation_id: conversationId
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Content-Language": "en" },
    });

  } catch (e: any) {
    logger.error("Ingestion error", { error: e });
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Content-Language": "en" },
    });
  }
});

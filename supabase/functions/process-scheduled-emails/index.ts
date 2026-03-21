import { serveWithLogger } from "../_shared/logger.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireServiceRoleOrAdmin } from "../_shared/auth.ts";

serveWithLogger(async (req, logger, supabase) => {
  const headers = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers });

  const access = await requireServiceRoleOrAdmin(req, supabase, logger);
  if (!access.authorized) {
    return new Response(JSON.stringify({ error: access.error || 'Unauthorized' }), {
      status: access.status,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  try {
    // supabase client injected by serveWithLogger is already service role
    
    // 1. Fetch pending emails
    const { data: emails, error } = await supabase
      .from("scheduled_emails")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .limit(50); // Batch size

    if (error) throw error;
    if (!emails || emails.length === 0) {
      return new Response(JSON.stringify({ message: "No emails to send" }), { 
        headers: { ...headers, "Content-Type": "application/json" } 
      });
    }

    const results = [];

    for (const email of emails) {
      // 2. Mark as processing
      await supabase.from("scheduled_emails").update({ status: "processing" }).eq("id", email.id);

      try {
        // 3. Call send-email function
        const { data, error: sendError } = await supabase.functions.invoke('send-email', {
          body: {
            accountId: email.account_id,
            to: email.to_emails,
            cc: email.cc_emails,
            bcc: email.bcc_emails,
            subject: email.subject,
            body: email.body_html,
            templateId: email.template_id,
            variables: email.template_variables,
          }
        });

        if (sendError) throw new Error(sendError.message);
        if (!data?.success) throw new Error(data?.error || "Unknown error from send-email");

        // 4. Update success
        await supabase.from("scheduled_emails").update({
          status: "sent",
          sent_at: new Date().toISOString()
        }).eq("id", email.id);
        
        results.push({ id: email.id, status: "sent" });

      } catch (err: any) {
        logger.error(`Failed to send email ${email.id}:`, { error: err });
        // 5. Update failure
        await supabase.from("scheduled_emails").update({
          status: "failed",
          error_message: err.message
        }).eq("id", email.id);
        
        results.push({ id: email.id, status: "failed", error: err.message });
      }
    }

    return new Response(JSON.stringify(results), { 
      headers: { ...headers, "Content-Type": "application/json" } 
    });

  } catch (error: any) {
    logger.error("Scheduler Error:", { error: error });
    return new Response(JSON.stringify({ error: error.message || String(error) }), { 
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" } 
    });
  }
}, "process-scheduled-emails");


import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

Deno.serve(async (req) => {
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thresholds = [30, 7, 1];
    const results = [];

    for (const days of thresholds) {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + days);
      const targetDateStr = targetDate.toISOString().split('T')[0];

      // Find documents expiring on this specific date (or close to it if running daily)
      // For simplicity, we check specifically for expiry_date = targetDateStr
      // In a real cron, we might check range, but deduplication handles repeated runs.
      const { data: documents, error: docError } = await supabase
        .from('vendor_documents')
        .select(`
          id,
          name,
          expiry_date,
          vendor_id,
          vendors (
            id,
            name,
            contact_info
          )
        `)
        .eq('expiry_date', targetDateStr)
        .neq('status', 'archived') // Don't alert for archived
        .neq('status', 'rejected'); // Don't alert for rejected

      if (docError) throw docError;

      if (!documents || documents.length === 0) continue;

      for (const doc of documents) {
        const notificationType = `expiration_${days}`;

        // Check if already notified
        const { data: existing, error: checkError } = await supabase
          .from('vendor_notifications')
          .select('id')
          .eq('document_id', doc.id)
          .eq('notification_type', notificationType)
          .single();

        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
           console.error(`Error checking notification for doc ${doc.id}:`, checkError);
           continue;
        }

        if (existing) {
          console.log(`Already notified for doc ${doc.id} (${notificationType})`);
          continue;
        }

        // Send Email
        // @ts-ignore: Handle Supabase response structure (object or array)
        const vendorData = Array.isArray(doc.vendors) ? doc.vendors[0] : doc.vendors;
        const vendorEmail = vendorData?.contact_info?.email;
        const vendorName = vendorData?.name || 'Vendor';

        if (vendorEmail) {
          const { data: emailData, error: emailError } = await supabase.functions.invoke('send-email', {
            body: {
              to: [vendorEmail],
              subject: `Action Required: Document Expiring in ${days} Days - ${doc.name}`,
              body: `
                <h1>Document Expiration Warning</h1>
                <p>Dear ${vendorName},</p>
                <p>This is a reminder that the following document is set to expire in <strong>${days} days</strong> on <strong>${doc.expiry_date}</strong>:</p>
                <ul>
                  <li><strong>Document Name:</strong> ${doc.name}</li>
                  <li><strong>Expiration Date:</strong> ${doc.expiry_date}</li>
                </ul>
                <p>Please log in to the vendor portal to upload a renewed version.</p>
                <p>Thank you,<br/>Logic Nexus AI Team</p>
              `
            }
          });

          if (emailError) {
             console.error(`Failed to send email for doc ${doc.id}:`, emailError);
             continue;
          }
        } else {
            console.warn(`No email found for vendor ${vendorName} (${doc.vendor_id})`);
        }

        // Log Notification
        await supabase.from('vendor_notifications').insert({
          vendor_id: doc.vendor_id,
          document_id: doc.id,
          notification_type: notificationType,
          status: vendorEmail ? 'sent' : 'skipped_no_email'
        });

        results.push({ doc_id: doc.id, type: notificationType, sent: !!vendorEmail });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results }), {
      headers: { ...headers, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Check Expiring Documents Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});

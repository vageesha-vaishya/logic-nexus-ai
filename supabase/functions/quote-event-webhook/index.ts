import { serveWithLogger } from "../_shared/logger.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

serveWithLogger(async (req, logger, supabaseClient) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { type, table, record, old_record } = body;

    logger.info(`Received ${type} event for table ${table}`);

    if (table !== 'quotes') {
      return new Response(JSON.stringify({ message: 'Ignored non-quote table' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const quoteId = record.id;
    const tenantId = record.tenant_id;
    let eventType = 'unknown';
    let eventDetails = {};

    // 1. Detect Standalone vs CRM Mode
    // Check if billing_address (guest info) is present and account_id is missing -> Standalone
    const isStandalone = !!record.billing_address && !record.account_id;
    
    // 2. Detect Changes
    if (type === 'INSERT') {
      eventType = 'quote_created';
      eventDetails = {
        mode: isStandalone ? 'standalone' : 'crm_linked',
        quote_number: record.quote_number,
        amount: record.total_amount
      };
    } else if (type === 'UPDATE') {
      eventType = 'quote_updated';
      const statusChanged = record.status !== old_record.status;
      const amountChanged = record.total_amount !== old_record.total_amount;
      
      eventDetails = {
        mode: isStandalone ? 'standalone' : 'crm_linked',
        status_changed: statusChanged,
        amount_changed: amountChanged,
        changes: {
          from: { status: old_record.status, amount: old_record.total_amount },
          to: { status: record.status, amount: record.total_amount }
        }
      };
    }

    // 3. Log High-Level Business Event
    if (eventType !== 'unknown') {
      await supabaseClient.from('quote_events').insert({
        quote_id: quoteId,
        tenant_id: tenantId,
        event_type: eventType,
        details: eventDetails,
        actor_id: record.updated_by || record.created_by // Fallback
      });
      logger.info(`Logged ${eventType} for quote ${quoteId}`);
    }

    // 4. CRM Integration Logic (Simulated)
    if (!isStandalone) {
      if (record.opportunity_id) {
        // Sync to Opportunity
        logger.info(`[CRM-SYNC] Syncing Quote ${record.quote_number} to Opportunity ${record.opportunity_id}`);
        // In real impl: call CRM API or internal CRM tables
      } else if (record.account_id) {
        // Sync to Account
        logger.info(`[CRM-SYNC] Syncing Quote ${record.quote_number} to Account ${record.account_id}`);
      }
    } else {
        logger.info(`[STANDALONE] Quote ${record.quote_number} is standalone. No CRM sync required.`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    logger.error('Error processing webhook:', error);
    return new Response(JSON.stringify({ error: error.message || String(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}, "quote-event-webhook");

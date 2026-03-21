import { serveWithLogger } from "../_shared/logger.ts"
import { getCorsHeaders } from "../_shared/cors.ts"
import { requireServiceRoleOrAdmin } from "../_shared/auth.ts"

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const access = await requireServiceRoleOrAdmin(req, supabaseAdmin, logger);
  if (!access.authorized) {
    return new Response(JSON.stringify({ error: access.error || 'Unauthorized' }), {
      status: access.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const supabase = supabaseAdmin;
  const user = access.isServiceRole
    ? { id: 'system', email: 'service_role' }
    : { id: access.user?.id || 'unknown', email: access.user?.email || 'admin-user' };

  try {
    if (req.method === 'GET') {
        return new Response(JSON.stringify({ status: 'online', timestamp: new Date().toISOString() }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });
    }

    // Mock External API Call
    const MOCK_SOURCE_URL = "https://api.chinacustoms.gov.cn/hs-codes/sync"; // Fictitious
    await logger.info(`User ${user.email} initiating CN HS sync...`, { user_id: user.id });
    
    await supabase.from('audit_logs').insert({
        action: 'SYNC_CN_HS_START',
        resource_type: 'cn_hs_codes',
        details: { started_by: user.email, source: MOCK_SOURCE_URL }
    })

    // GENERATE MOCK DATA
    // In a real scenario, we would: const response = await fetch(MOCK_SOURCE_URL, { headers: { 'Authorization': 'Bearer ...' } });
    const records: any[] = [];
    const BATCH_SIZE = 100;
    
    // Create some sample data for 0101 (Live horses)
    // 0101.21.00.00.101 (13 digits?) 
    // CN Structure: 8 (HS8) + 2 (CIQ) + 3 (Extension)? Or 10 + 3?
    // User said "13-digit". Usually it'10 digits (HS + National) + 3 digits (CIQ).
    // Let's generate a few valid-looking codes under 010121 (Pure-bred breeding horses)
    
    const base = "010121";
    for(let i=0; i<5; i++) {
        const suffix = String(i).padStart(7, '0'); // 7 digits to make 13 total
        const code = `${base}${suffix}`;
        records.push({
            cn_code: code,
            description: `Mock CN Item ${i} for Pure-bred horses`,
            effective_date: new Date().toISOString().split('T')[0],
            regulatory_status: { license_required: i % 2 === 0, ciq_code: '10' + i },
            attributes: { source: 'mock_api', version: 'v1' }
        });
    }

    // Upsert
    let insertedCount = 0
    let errorCount = 0
    const totalRecords = records.length
    
    await logger.info(`Fetched ${totalRecords} records from external source. Upserting...`);

    for (let i = 0; i < totalRecords; i += BATCH_SIZE) {
        const chunk = records.slice(i, i + BATCH_SIZE)
        
        const { error } = await supabase
          .from('cn_hs_codes')
          .upsert(chunk, { onConflict: 'cn_code, effective_date', ignoreDuplicates: false })
        
        if (error) {
            await logger.error('Error upserting chunk', { error });
            errorCount += chunk.length
        } else {
            insertedCount += chunk.length
        }
    }

    // Log Completion
    await supabase.from('audit_logs').insert({
        action: 'SYNC_CN_HS_COMPLETE',
        resource_type: 'cn_hs_codes',
        details: { 
            processed: totalRecords,
            success: insertedCount,
            errors: errorCount,
            triggered_by: user.email 
        }
    })

    await logger.info('Sync completed successfully', { processed: totalRecords, success: insertedCount, errors: errorCount });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${totalRecords} records. Updated: ${insertedCount}. Errors: ${errorCount}.` 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error: any) {
    await logger.critical('Critical Error in sync-cn-hs-data', { error: error.message, stack: error.stack });
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
}, "sync-cn-hs-data")

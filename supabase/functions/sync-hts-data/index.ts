
import { serveWithLogger } from "../_shared/logger.ts"
import { getCorsHeaders } from "../_shared/cors.ts"
import { requireAuth } from "../_shared/auth.ts"

declare const Deno: any;

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const corsHeaders = getCorsHeaders(req);
  // Extract Correlation ID from headers or generate new one
  const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();

  await logger.info(`Request received: ${req.method} ${req.url}`);

  // 1. Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Allow service role key OR authenticated user
  const authHeader = req.headers.get('Authorization');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const isServiceRole = authHeader && serviceKey && authHeader.includes(serviceKey);
  
  let user: any = null;

  if (isServiceRole) {
    user = { id: 'system', email: 'system@internal' };
    logger.info('Authenticated as Service Role');
  } else {
    const { user: authUser, error: authError } = await requireAuth(req);
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    user = authUser;
  }

  try {
    // 2. Health Check (GET)
    if (req.method === 'GET') {
        return new Response(JSON.stringify({ status: 'online', timestamp: new Date().toISOString() }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });
    }

    // 3. Initialize Supabase Client
    // Use the injected admin client for DB operations
    const supabase = supabaseAdmin;
    
    // 5. Fetch Census Data
    const CENSUS_URL = "https://www.census.gov/foreign-trade/aes/documentlibrary/concordance/expaes.txt"
    await logger.info(`User ${user.email} initiating sync...`, { user_id: user.id });
    
    // Log start (Business Audit)
    await supabase.from('audit_logs').insert({
        action: 'SYNC_AES_HTS_START',
        resource_type: 'aes_hts_codes',
        details: { started_by: user.email, source: CENSUS_URL }
    })

    const response = await fetch(CENSUS_URL)
    if (!response.ok) {
        throw new Error(`Failed to fetch Census data: ${response.status} ${response.statusText}`)
    }
    
    const text = await response.text()
    const lines = text.split('\n')
    
    const records: any[] = []
    const BATCH_SIZE = 100
    
    // 6. Parse Data
    for (const line of lines) {
       if (line.length < 10) continue
       
       const codeRaw = line.substring(0, 10).trim()
       if (!codeRaw || isNaN(Number(codeRaw))) continue
       
       // Format: XXXX.XX.XX.XX
       const fmtCode = `${codeRaw.substring(0,4)}.${codeRaw.substring(4,6)}.${codeRaw.substring(6,8)}.${codeRaw.substring(8,10)}`
       const desc = line.substring(15, 165).trim()
       const uom1 = line.substring(170, 173).trim()
       const uom2 = line.substring(178, 181).trim()
       
       if (!desc) continue

       records.push({
         hts_code: fmtCode,
         description: desc,
         uom1: uom1 || null,
         uom2: uom2 || null,
         category: 'Export Commodity', 
         schedule_b: fmtCode, 
         updated_at: new Date().toISOString()
       })
    }

    // 7. Batch Upsert
    let insertedCount = 0
    let errorCount = 0
    const totalRecords = records.length
    
    await logger.info(`Parsed ${totalRecords} records. Upserting...`);

    for (let i = 0; i < totalRecords; i += BATCH_SIZE) {
        const chunk = records.slice(i, i + BATCH_SIZE)
        
        const { error } = await supabase
          .from('aes_hts_codes')
          .upsert(chunk, { onConflict: 'hts_code', ignoreDuplicates: false })
        
        if (error) {
            await logger.error('Error upserting chunk', { error });
            errorCount += chunk.length
        } else {
            insertedCount += chunk.length
        }
    }

    // 8. Log Completion
    await supabase.from('audit_logs').insert({
        action: 'SYNC_AES_HTS_COMPLETE',
        resource_type: 'aes_hts_codes',
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
    // If we have a supabase client, try to log the error to DB
    // We can re-create the logger if scope is lost, but here we likely have 'supabase' in scope if it didn't fail before initialization
    // But 'dbLogger' is scoped to the try block.
    // Let's use a safe fallback.
    await logger.error('Critical Error in sync-hts-data', { error: error.message, stack: error.stack });
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
}, "sync-hts-data");

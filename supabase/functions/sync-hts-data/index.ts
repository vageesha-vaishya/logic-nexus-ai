
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

Deno.serve(async (req) => {
  console.log(`[Sync] Request received: ${req.method} ${req.url}`);

  // 1. Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 4. Verify Authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      })
    }
    
    // Verify token using a separate client
    const supabaseAuth = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
    
    if (authError || !user) {
        console.error("Auth failed:", authError);
        return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or expired token', details: authError?.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401
        })
    }

    // 5. Fetch Census Data
    const CENSUS_URL = "https://www.census.gov/foreign-trade/aes/documentlibrary/concordance/expaes.txt"
    console.log(`[Sync] User ${user.email} initiating sync...`)
    
    // Log start
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
    
    console.log(`[Sync] Parsed ${totalRecords} records. Upserting...`)

    for (let i = 0; i < totalRecords; i += BATCH_SIZE) {
        const chunk = records.slice(i, i + BATCH_SIZE)
        
        const { error } = await supabase
          .from('aes_hts_codes')
          .upsert(chunk, { onConflict: 'hts_code', ignoreDuplicates: false })
        
        if (error) {
            console.error('[Sync] Error upserting chunk:', error)
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
    console.error('[Sync] Critical Error:', error)
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

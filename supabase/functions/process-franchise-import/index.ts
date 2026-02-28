import { serveWithLogger } from "../_shared/logger.ts"
import { getCorsHeaders } from "../_shared/cors.ts"
import { requireAuth } from "../_shared/auth.ts"

declare const Deno: any;

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

serveWithLogger(async (req, logger, supabase) => {
  const corsHeaders = getCorsHeaders(req);
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Auth: require authenticated user
  const { user, error: authError } = await requireAuth(req);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const { data } = await req.json()

    if (!data || !Array.isArray(data)) {
      throw new Error('Invalid data format. Expected an array of objects.')
    }

    logger.info(`Processing ${data.length} records...`)

    // In a real scenario with OpenAI key:
    /*
    const prompt = `
      Map the following data to the schema:
      {
        name: string,
        code: string,
        address: {
          street: string,
          city: string,
          state: string,
          zip: string,
          country: string
        },
        contact: {
          phone: string,
          email: string
        }
      }
      
      Data: ${JSON.stringify(data.slice(0, 5))} // Process in batches
    `;
    
    const completion = await openai.createCompletion({...})
    */

    // Heuristic Mapping (Mocking LLM behavior)
    // This logic attempts to find the best matching keys for our schema
    const mappedData = data.map((row: any) => {
      const normalized: any = {
        name: row.name || row.Name || row.company || row.Company || row.Franchise || '',
        code: row.code || row.Code || row.id || row.ID || generateCode(row.name || row.Name || ''),
        is_active: true,
        address: {
          street: row.street || row.Street || row.address || row.Address || '',
          city: row.city || row.City || '',
          state: row.state || row.State || row.province || '',
          zip: row.zip || row.Zip || row.postal_code || row.PostalCode || '',
          country: row.country || row.Country || '',
          contact: {
            phone: row.phone || row.Phone || row.tel || row.mobile || '',
            email: row.email || row.Email || row.mail || '',
            website: row.website || row.Website || ''
          },
          communication: {
            whatsapp: row.whatsapp || '',
            telegram: row.telegram || '',
            preferred_method: 'email'
          },
          demographics: {
            founded_year: row.founded_year ? parseInt(row.founded_year) : undefined,
            employee_count: row.employee_count ? parseInt(row.employee_count) : undefined,
            revenue_range: row.revenue_range || ''
          }
        }
      }
      return normalized
    })

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: mappedData,
        message: 'Data processed successfully' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error processing franchise import:', { error: error });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
}, "process-franchise-import")

function generateCode(name: string): string {
  if (!name) return 'FR-' + Math.random().toString(36).substr(2, 6).toUpperCase();
  return name.substring(0, 3).toUpperCase() + '-' + Math.floor(Math.random() * 1000);
}

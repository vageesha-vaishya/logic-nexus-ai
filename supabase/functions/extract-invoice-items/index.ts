import { serve } from "std/http/server.ts"
import { createClient } from "@supabase/supabase-js"
import { corsHeaders } from "../_shared/cors.ts"

declare const Deno: {
  env: { get(name: string): string | undefined };
};

console.log("Invoice Extractor v1.0 Initialized")

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { file_url, file_type } = await req.json()
    
    // Validate Input
    if (!file_url) {
      throw new Error('Missing file_url');
    }

    const openAiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAiKey) {
        throw new Error('Missing OPENAI_API_KEY');
    }

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Processing Invoice: ${file_url}`);

    // 1. Prepare Image for GPT-4o (Vision)
    // If it's a PDF, we assume the frontend or a previous step converted it to an image or 
    // we use a service to read it. For this MVP, we support Image URLs directly.
    // If it is a PDF URL, GPT-4o might not read it directly unless we download and convert.
    // Assuming the URL is publicly accessible or signed.
    
    // 2. Call OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert logistics invoice analyzer. 
            Extract line items from the provided invoice image. 
            Return a JSON object with a key "items" containing an array of objects.
            Each object must have:
            - description (string)
            - quantity (number)
            - unit_price (number)
            - total_price (number)
            - hs_code (string, if visible)
            - weight_kg (number, if visible)
            - origin_country (string, if visible)
            
            Do not include markdown formatting like \`\`\`json. Just return the raw JSON string.`
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract the line items from this invoice.' },
              {
                type: 'image_url',
                image_url: {
                  url: file_url,
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
        const error = await response.text();
        console.error("OpenAI Error:", error);
        throw new Error(`OpenAI API Error: ${response.statusText}`);
    }

    const aiData = await response.json();
    const content = aiData.choices[0].message.content;
    
    let extractedData;
    try {
        // Clean potential markdown code blocks if GPT ignored instructions
        const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
        extractedData = JSON.parse(cleanContent);
    } catch (e) {
        console.error("JSON Parse Error:", content);
        throw new Error("Failed to parse AI response as JSON");
    }

    // 3. Enrich with Master Data (Smart Mapping)
    const enrichedItems = await Promise.all(extractedData.items.map(async (item: any) => {
        // Search for HTS/Commodity Match
        const searchTerm = item.hs_code || item.description;
        
        let match = null;
        
        // Try exact match if HS code exists
        if (item.hs_code) {
             const { data } = await supabase.rpc('search_hts_codes_smart', { 
                p_search_term: item.hs_code, 
                p_limit: 1 
            });
            if (data && data.length > 0) match = data[0];
        }
        
        // Fallback to description search
        if (!match && item.description) {
            const { data } = await supabase.rpc('search_hts_codes_smart', { 
                p_search_term: item.description, 
                p_limit: 1 
            });
            if (data && data.length > 0) match = data[0];
        }

        return {
            ...item,
            suggested_aes_hts_id: match ? match.id : null,
            suggested_hts_code: match ? match.hts_code : null,
            suggested_category: match ? match.category : null,
            confidence: match ? match.rank : 0
        };
    }));

    return new Response(
      JSON.stringify({ 
          success: true, 
          original_items: extractedData.items,
          enriched_items: enrichedItems 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error(error)
    return new Response(
      JSON.stringify({ error: error.message || 'An unknown error occurred' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

import { serve } from "std/http/server.ts"
import { createClient } from "@supabase/supabase-js"
import { corsHeaders } from "../_shared/cors.ts"

declare const Deno: {
  env: { get(name: string): string | undefined };
};

console.log("Cargo Damage Analyzer v1.0 Initialized")

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { file_url } = await req.json()
    
    // Validate Input
    if (!file_url) {
      throw new Error('Missing file_url');
    }

    const openAiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAiKey) {
        throw new Error('Missing OPENAI_API_KEY');
    }

    console.log(`Analyzing Cargo Image: ${file_url}`);

    // Call OpenAI GPT-4o
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
            content: `You are an expert cargo inspector and logistics compliance officer. 
            Analyze the provided image of cargo/packaging for any signs of damage or non-compliance.
            
            Return a JSON object with the following structure (no markdown):
            {
              "damage_detected": boolean,
              "damage_type": "none" | "crushed" | "wet" | "punctured" | "torn" | "broken_seal" | "other",
              "severity": "none" | "low" | "medium" | "high" | "critical",
              "description": "string (detailed visual observation)",
              "recommendation": "Accept" | "Reject" | "Inspect Content" | "Repack",
              "confidence": number (0-1)
            }
            
            If the image is not of cargo or packaging, set damage_type to "other" and description to "Image does not appear to be cargo".`
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Inspect this cargo for damage.' },
              {
                type: 'image_url',
                image_url: {
                  url: file_url,
                },
              },
            ],
          },
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenAI Error:", errorText);
        throw new Error(`OpenAI API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const aiData = await response.json();
    const content = aiData.choices[0].message.content;
    
    let analysisResult;
    try {
        // Clean potential markdown code blocks
        const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
        analysisResult = JSON.parse(cleanContent);
    } catch (e) {
        console.error("JSON Parse Error:", content);
        throw new Error("Failed to parse AI response as JSON");
    }

    return new Response(
      JSON.stringify({ 
          success: true, 
          analysis: analysisResult,
          timestamp: new Date().toISOString()
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

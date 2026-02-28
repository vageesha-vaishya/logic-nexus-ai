import { serveWithLogger } from "../_shared/logger.ts"
import { getCorsHeaders } from "../_shared/cors.ts"
import { requireAuth } from "../_shared/auth.ts"

declare const Deno: any;

serveWithLogger(async (req, logger, _supabase) => {
  logger.info("Cargo Damage Analyzer v1.0 Initialized")

  const headers = getCorsHeaders(req);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  try {
    const { user, error: authError } = await requireAuth(req, logger);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    const { file_url } = await req.json()
    
    // Validate Input
    if (!file_url) {
      throw new Error('Missing file_url');
    }

    const openAiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAiKey) {
        throw new Error('Missing OPENAI_API_KEY');
    }

    logger.info(`Analyzing Cargo Image: ${file_url}`);

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
        logger.error("OpenAI Error", { error: errorText });
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
        logger.error("JSON Parse Error", { content });
        throw new Error("Failed to parse AI response as JSON");
    }

    return new Response(
      JSON.stringify({ 
          success: true, 
          analysis: analysisResult,
          timestamp: new Date().toISOString()
      }),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    logger.error('Error analyzing cargo damage', { error })
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...headers, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
}, "analyze-cargo-damage")

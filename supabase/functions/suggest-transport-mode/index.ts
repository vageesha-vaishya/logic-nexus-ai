import { corsHeaders } from '../_shared/cors.ts';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { prompt, model, responseFormat } = await req.json();
    
    // Check for available API keys
    const geminiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY');
    const openAiKey = Deno.env.get('OPENAI_API_KEY');

    let text = "";
    let usedService = "none";
    let usedModel = "none";
    const startTime = Date.now();

    // STRATEGY 1: Use Gemini if key exists
    if (geminiKey) {
        usedService = "Gemini";
        const targetModel = model || 'gemini-2.0-flash';
        usedModel = targetModel;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${geminiKey}`;

        try {
          const bodyPayload: any = {
              contents: [{ parts: [{ text: prompt }] }]
          };
          
          if (responseFormat === 'json') {
              bodyPayload.generationConfig = { responseMimeType: "application/json" };
          }

          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyPayload),
          });

          if (response.ok) {
              const data = await response.json();
              text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          } else {
              console.error("Gemini API failed with status:", response.status);
          }
        } catch (e) {
          console.error("Gemini API error:", e);
        }
    }

    // STRATEGY 2: Use OpenAI if Gemini failed/skipped and key exists
    if (!text && openAiKey) {
        usedService = "OpenAI";
        const targetModel = 'gpt-4o-mini';
        usedModel = targetModel;
        try {
          const bodyPayload: any = {
              model: targetModel,
              messages: [{ role: 'user', content: prompt }],
          };

          if (responseFormat === 'json') {
              bodyPayload.response_format = { type: "json_object" };
          }

          const response = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                  'Authorization': `Bearer ${openAiKey}`,
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify(bodyPayload),
          });

          if (response.ok) {
              const data = await response.json();
              text = data.choices?.[0]?.message?.content || '';
          } else {
               console.error("OpenAI API failed with status:", response.status);
          }
        } catch (e) {
          console.error("OpenAI API error:", e);
        }
    }

    // STRATEGY 3: Heuristic Fallback (Offline Mode)
    // If no keys are set or both APIs fail, use simple keyword matching to ensure the feature works.
    if (!text) {
        usedService = "Heuristic (Fallback)";
        usedModel = "keyword-match";
        console.log("Using heuristic fallback logic.");
        const lowerPrompt = (prompt || "").toLowerCase();
        let suggestion = "Road Freight"; // Default

        if (lowerPrompt.includes("air") || lowerPrompt.includes("flight") || lowerPrompt.includes("urgent") || lowerPrompt.includes("plane")) {
            suggestion = "Air Freight";
        } else if (lowerPrompt.includes("sea") || lowerPrompt.includes("ocean") || lowerPrompt.includes("container") || lowerPrompt.includes("vessel") || lowerPrompt.includes("port")) {
            suggestion = "Sea Freight";
        } else if (lowerPrompt.includes("rail") || lowerPrompt.includes("train")) {
            suggestion = "Rail Freight";
        }
        
        // Mimic the expected LLM output format so the UI parses it correctly
        text = `Analysis (Offline Mode): Recommended Transport: [${suggestion}]`;
    }

    const duration_ms = Date.now() - startTime;

    return new Response(JSON.stringify({ 
      text,
      meta: {
        service: usedService,
        model: usedModel,
        prompt: prompt, // Echo back for logging
        duration_ms: duration_ms,
        timestamp: new Date().toISOString()
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || String(error) }), {
      status: 200, // Return 200 so client parses error message
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
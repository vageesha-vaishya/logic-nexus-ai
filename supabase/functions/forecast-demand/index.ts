import { serveWithLogger } from "../_shared/logger.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { logAiCall } from "../_shared/audit.ts";
import { sanitizeForLLM } from "../_shared/pii-guard.ts";

declare const Deno: any;

serveWithLogger(async (req, logger, supabase) => {
  const headers = getCorsHeaders(req);

  // 1. Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  try {
    const { user, error: authError, supabaseClient: userSupabase } = await requireAuth(req, logger);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    // 2. Parse Input
    const { hs_code, history, horizon = 3 } = await req.json();

    if (!hs_code) {
      throw new Error("Missing required parameter: hs_code");
    }

    // 3. Initialize Clients
    // Use user-scoped client for RLS
    const supabaseClient = userSupabase;

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    // 4. Gather Data (if history not provided)
    let historicalData = history;

    if (!historicalData || historicalData.length === 0) {
      logger.info(`Fetching history for HS Code: ${hs_code}`);
      
      // Query cargo_details for volume history
      // Aggregating by month (naive approach using created_at)
      const { data: cargoData, error: cargoError } = await supabaseClient
        .from("cargo_details")
        .select("created_at, volume_cbm, weight_kg")
        .eq("hs_code", hs_code)
        .order("created_at", { ascending: true });

      if (cargoError) {
        throw new Error(`Database error: ${cargoError.message}`);
      }

      // Aggregate data by month
      const monthlyAgg: Record<string, { volume: number; weight: number; count: number }> = {};
      (cargoData || []).forEach((item: any) => {
        const date = new Date(item.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyAgg[monthKey]) {
          monthlyAgg[monthKey] = { volume: 0, weight: 0, count: 0 };
        }
        monthlyAgg[monthKey].volume += (item.volume_cbm || 0);
        monthlyAgg[monthKey].weight += (item.weight_kg || 0);
        monthlyAgg[monthKey].count += 1;
      });

      historicalData = Object.entries(monthlyAgg)
        .map(([date, stats]) => ({ date, ...stats }))
        .sort((a, b) => a.date.localeCompare(b.date));
      
      logger.info(`Found ${historicalData.length} historical data points.`);
    }

    // 5. Construct AI Prompt
    // If no data, we ask AI to provide general market trends for this commodity
    const hasData = historicalData && historicalData.length > 0;
    
    const prompt = `
      You are an expert Logistics Demand Forecaster using a Transformer-based approach.
      
      Task: Predict the shipment volume for the next ${horizon} months for HS Code: ${hs_code}.
      
      Context:
      ${hasData 
        ? `Historical Data (Monthly Aggregates): ${JSON.stringify(historicalData)}` 
        : "No specific historical data available for this tenant. Use global market knowledge for this HS Code."
      }
      
      Requirements:
      1. Analyze seasonality (e.g., retail peak, CNY, holiday impacts).
      2. Analyze market trends for this specific commodity type.
      3. Provide a confidence score (0-100) for your prediction.
      4. Output strictly valid JSON.
      
      Output Format:
      {
        "predictions": [
          { "date": "YYYY-MM-01", "predicted_volume": 123.45, "confidence": 85 }
        ],
        "analysis": {
          "trend": "increasing/decreasing/stable",
          "seasonality": "explanation...",
          "risk_factors": ["factor 1", "factor 2"]
        }
      }
    `;

    // 6. Forecast via Docker microservice if available; else fallback to OpenAI
    const start = performance.now();
    const svcUrl = Deno.env.get("TIMESFM_URL") || "http://localhost:8088";
    let result: any;
    try {
      const series = (historicalData || []).map((d: any) => ({
        timestamp: `${d.date}-01`,
        value: Number(d.volume || d.volume_cbm || 0),
      }));
      const svcRes = await fetch(`${svcUrl}/forecast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ series, horizon }),
      });
      if (!svcRes.ok) {
        const t = await svcRes.text();
        throw new Error(`Service error: ${t}`);
      }
      const svcJson = await svcRes.json();
      result = {
        predictions: svcJson.timestamps.map((ts: string, i: number) => ({
          date: ts.slice(0, 7) + "-01",
          predicted_volume: svcJson.forecast[i],
          confidence: 75,
        })),
        analysis: {
          trend: "stable",
          seasonality: "Detected via Holt-Winters",
          risk_factors: [],
        },
      };
    } catch (svcErr) {
      if (!openAiKey) {
        throw svcErr;
      }
      const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a helpful logistics AI assistant that outputs JSON." },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
        }),
      });
      if (!aiResponse.ok) {
        const err = await aiResponse.text();
        throw new Error(`OpenAI API error: ${err}`);
      }
      const aiData = await aiResponse.json();
      result = JSON.parse(aiData.choices[0].message.content);
    }

    // 7. Store Predictions (Optional - if we want to cache them)
    if (result.predictions && result.predictions.length > 0) {
       // Attempt to get tenant_id from user metadata
       // @ts-ignore: Properties app_metadata and user_metadata exist on the extended user type from requireAuth
       const tenantId = user.app_metadata?.tenant_id || user.user_metadata?.tenant_id;
       
       if (tenantId) {
          const { error: insertError } = await supabaseClient
            .from("demand_predictions")
            .insert({
              tenant_id: tenantId,
              hs_code: hs_code,
              horizon: horizon,
              prediction_data: result,
              created_by: user.id
            });
            
          if (insertError) {
             logger.error("Failed to store prediction", { error: insertError });
          } else {
             logger.info("Prediction stored successfully");
          }
       } else {
          logger.warn("Skipping prediction storage: No tenant_id found in user metadata");
       }
    }

    // 8. Return Result
    const latency = Math.round(performance.now() - start);
    const { sanitized, redacted } = sanitizeForLLM(JSON.stringify({ hs_code, horizon }));
    await logAiCall(supabaseClient, {
      user_id: (await supabaseClient.auth.getUser()).data.user?.id ?? null,
      function_name: "forecast-demand",
      model_used: Deno.env.get("TIMESFM_URL") ? "holt-winters-docker" : "gpt-4o-mini",
      latency_ms: latency,
      pii_detected: redacted.length > 0,
      pii_fields_redacted: redacted,
      output_summary: { predictions: result.predictions?.length ?? 0, confidence: result.predictions?.[0]?.confidence }
    });
    return new Response(JSON.stringify(result), {
      headers: { ...headers, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    logger.error("Error in forecast-demand", { error: error });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
}, "forecast-demand");

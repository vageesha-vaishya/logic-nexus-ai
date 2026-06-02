-- LLM Gateway P1.4 — provider catalog seed for OpenAI / Gemini / Mistral.
-- Per-million-token rates from currently-published pricing (2026-06).
-- ON CONFLICT DO NOTHING so re-applies are safe + admin overrides win.

INSERT INTO gateway.provider_models (provider_kind, model_id, capabilities, context_window,
                                     input_cost_per_million_tokens, output_cost_per_million_tokens)
VALUES
  ('openai',        'gpt-4o',                    ARRAY['tools','vision','json_mode'],   128000,  5,    15),
  ('openai',        'gpt-4o-mini',               ARRAY['tools','vision','json_mode'],   128000,  0.15, 0.6),
  ('google_gemini', 'gemini-1.5-pro',            ARRAY['tools','vision','json_mode'],   2000000, 1.25, 5),
  ('google_gemini', 'gemini-1.5-flash',          ARRAY['tools','vision','json_mode'],   1000000, 0.075, 0.3),
  ('mistral',       'mistral-large-latest',      ARRAY['tools','json_mode'],            128000,  2,    6),
  ('mistral',       'mistral-small-latest',      ARRAY['tools','json_mode'],            32000,   0.2,  0.6)
ON CONFLICT (provider_kind, model_id) DO NOTHING;

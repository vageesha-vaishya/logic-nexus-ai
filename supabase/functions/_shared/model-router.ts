type Provider = "openai" | "google";
type Tier = "low" | "mid" | "high";

export function pickEmbeddingModel(): {
  provider: Provider;
  model: string;
  url: string;
  headers: HeadersInit;
} {
  const key = Deno.env.get("OPENAI_API_KEY") ?? "";
  return {
    provider: "openai",
    model: "text-embedding-3-small",
    url: "https://api.openai.com/v1/embeddings",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  };
}

export function pickClassifier(tier: Tier = "low"): {
  provider: Provider;
  model: string;
  url: string;
  headers: HeadersInit;
} {
  const key = Deno.env.get("GOOGLE_API_KEY") ?? "";
  const model = tier === "low" ? "gemini-2.5-flash" : "gemini-2.5-pro";
  return {
    provider: "google",
    model,
    url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    headers: { "Content-Type": "application/json" },
  };
}

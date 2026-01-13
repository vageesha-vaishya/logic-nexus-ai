export interface ClassificationResult {
  category: "crm" | "non_crm" | "feedback";
  sentiment: "very_negative" | "negative" | "slightly_negative" | "neutral" | "slightly_positive" | "positive" | "very_positive";
  intent?: "support" | "sales" | "other";
}

export const classifyEmailContent = (subject: string, body: string): ClassificationResult => {
  // Simple keyword-based classification for now
  const lowerSubject = subject.toLowerCase();
  const lowerBody = body.toLowerCase();
  const combined = lowerSubject + " " + lowerBody;

  let category: ClassificationResult['category'] = "non_crm";
  let sentiment: ClassificationResult['sentiment'] = "neutral";
  let intent: ClassificationResult['intent'] = "other";

  // Category detection
  if (combined.includes("feedback") || combined.includes("survey") || combined.includes("nps")) {
    category = "feedback";
  } else if (combined.includes("support") || combined.includes("help") || combined.includes("issue") || combined.includes("quote")) {
    category = "crm";
  }

  // Sentiment detection (very basic)
  if (combined.includes("angry") || combined.includes("upset") || combined.includes("terrible") || combined.includes("worst")) {
    sentiment = "very_negative";
  } else if (combined.includes("bad") || combined.includes("poor") || combined.includes("disappointed")) {
    sentiment = "negative";
  } else if (combined.includes("great") || combined.includes("excellent") || combined.includes("love")) {
    sentiment = "positive";
  }

  // Intent detection
  if (combined.includes("price") || combined.includes("cost") || combined.includes("buy") || combined.includes("purchase")) {
    intent = "sales";
  } else if (combined.includes("broken") || combined.includes("error") || combined.includes("bug") || combined.includes("fail")) {
    intent = "support";
  }

  return { category, sentiment, intent };
};

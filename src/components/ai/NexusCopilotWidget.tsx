import React, { useState } from "react";

export default function NexusCopilotWidget() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [snippets, setSnippets] = useState<any[]>([]);

  const runCopilot = async () => {
    setLoading(true);
    setError(null);
    setAnswer("");
    setSnippets([]);
    try {
      const res = await fetch("/functions/v1/nexus-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, topK: 6 }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Request failed");
      setAnswer(json.answer || "");
      setSnippets(json.snippets || []);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
      <h3 style={{ marginBottom: 8 }}>Nexus Copilot</h3>
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Ask a question..."
        rows={3}
        style={{ width: "100%", marginBottom: 8 }}
      />
      <button onClick={runCopilot} disabled={loading || !query.trim()}>
        {loading ? "Thinking..." : "Ask"}
      </button>
      {error && <div style={{ color: "red", marginTop: 8 }}>{error}</div>}
      {answer && (
        <div style={{ marginTop: 12 }}>
          <strong>Answer:</strong>
          <div style={{ whiteSpace: "pre-wrap" }}>{answer}</div>
        </div>
      )}
      {snippets.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <strong>Context Snippets:</strong>
          <ul>
            {snippets.map((s, i) => (
              <li key={i}>
                <div><strong>{s.title}</strong></div>
                <div style={{ whiteSpace: "pre-wrap" }}>{s.content}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

import React, { useState } from "react";

export default function PortalCopilot({ token }: { token?: string }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [actions, setActions] = useState<any[]>([]);

  const ask = async () => {
    setLoading(true);
    setError(null);
    setAnswer("");
    setActions([]);
    try {
      const res = await fetch("/functions/v1/portal-chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, token }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Request failed");
      setAnswer(json.answer || "");
      setActions(json.actions || []);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border rounded-md p-3">
      <div className="text-sm font-medium mb-1">Ask the Copilot</div>
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Ask about this quote, timelines, or shipping details..."
        rows={3}
        className="w-full border rounded p-2 text-sm"
      />
      <div className="mt-2 flex items-center gap-2">
        <button className="px-3 py-1.5 border rounded text-sm" onClick={ask} disabled={loading || !query.trim()}>
          {loading ? "Thinking..." : "Ask"}
        </button>
        {error && <div className="text-red-600 text-xs">{error}</div>}
      </div>
      {answer && (
        <div className="mt-3 text-sm whitespace-pre-wrap">
          {answer}
        </div>
      )}
      {actions?.length > 0 && (
        <div className="mt-2">
          <div className="text-xs text-muted-foreground mb-1">Suggested actions:</div>
          <ul className="list-disc pl-5 text-sm">
            {actions.map((a, i) => (
              <li key={i}>{a.type}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

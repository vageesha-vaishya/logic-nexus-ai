/**
 * Markets — AI Chat Page
 *
 * Route: /dashboard/markets/ai-chat
 * Full dedicated page with desktop two-column layout:
 *   Left sidebar (280 px) — session list + New Chat
 *   Main area            — messages + bottom input
 *
 * Streaming via fetch + ReadableStream (same SSE protocol as AIAssistantPanel).
 * Keyboard shortcut: Cmd+Enter / Ctrl+Enter to send.
 */

import {
  Bot,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MarkdownMessage } from "../components/MarkdownMessage";
import {
  type Message,
  type Session,
  useChatMessages,
  useChatSessions,
  useCreateSession,
  useDeleteSession,
} from "../hooks/useAIChat";

const WORKER_URL =
  import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001";

// ── Helpers ────────────────────────────────────────────────────────────────────

function relativeTime(iso: string) {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

// ── Message bubble ──────────────────────────────────────────────────────────────

function MessageBubble({
  msg,
}: {
  msg: Message & { streaming?: boolean };
}) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-3 px-4 py-2.5", isUser ? "flex-row-reverse" : "")}>
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-0.5",
          isUser
            ? "bg-blue-600 text-white"
            : "bg-gradient-to-br from-purple-500 to-indigo-500 text-white",
        )}
      >
        {isUser ? (
          <span className="text-[10px] font-bold select-none">You</span>
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          "flex max-w-[75%] flex-col gap-1",
          isUser ? "items-end" : "items-start",
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-blue-600 text-white rounded-tr-sm"
              : "bg-muted text-foreground rounded-tl-sm",
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
          ) : msg.streaming ? (
            <span>
              {msg.content}
              <span className="ml-0.5 inline-block w-[2px] h-[1em] bg-current animate-pulse align-middle" />
            </span>
          ) : (
            <MarkdownMessage content={msg.content} />
          )}
        </div>
        <span className="px-1 text-[10px] text-muted-foreground">
          {relativeTime(msg.created_at)}
        </span>
      </div>
    </div>
  );
}

// ── Session list item ─────────────────────────────────────────────────────────

function SessionItem({
  session,
  active,
  onSelect,
  onDelete,
}: {
  session: Session;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={cn(
        "group relative flex cursor-pointer items-start gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors select-none",
        active
          ? "bg-primary/10 text-primary"
          : "hover:bg-muted/60 text-foreground",
      )}
    >
      <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-50" />
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium leading-tight">
          {session.title || "New conversation"}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {relativeTime(session.updated_at)}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 text-destructive hover:text-destructive"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label="Delete session"
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ onHintClick }: { onHintClick: (text: string) => void }) {
  const hints = [
    "What's the NIFTY 50 outlook for this quarter?",
    "Analyse HDFC Bank vs ICICI Bank on key metrics",
    "Explain how FII flows affect equity markets",
    "Best options strategy for a bullish view on Reliance?",
    "What does RBI rate decision mean for bonds?",
    "How do I read open interest in F&O data?",
  ];

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 px-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20">
        <Sparkles className="h-8 w-8 text-purple-500" />
      </div>
      <div className="space-y-2">
        <p className="text-xl font-semibold">AI Markets Assistant</p>
        <p className="text-sm text-muted-foreground max-w-md">
          Start a conversation about markets, your portfolio, or any trading question.
          Grounded in live Indian market data.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2 max-w-xl">
        {hints.map((hint) => (
          <button
            key={hint}
            type="button"
            onClick={() => onHintClick(hint)}
            className="rounded-full border bg-background px-4 py-2 text-xs text-muted-foreground hover:border-purple-500 hover:text-purple-500 transition-colors text-left"
          >
            {hint}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AIChatPage() {
  const { session: authSession } = useAuth() as any;
  const token: string | undefined = authSession?.access_token;

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<(Message & { streaming?: boolean })[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [inputText, setInputText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { data: sessions = [], isLoading: sessionsLoading } = useChatSessions();
  const { data: remoteMessages = [], isLoading: msgsLoading } = useChatMessages(activeSessionId);
  const createSession = useCreateSession();
  const deleteSession = useDeleteSession();

  // Context symbol
  const [contextSymbol] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("symbol") || localStorage.getItem("lnai_terminal_symbol");
    }
    return null;
  });

  // Compose display messages
  const displayMessages: (Message & { streaming?: boolean })[] =
    isStreaming
      ? [
          ...remoteMessages,
          ...localMessages.filter((m) => !remoteMessages.find((r) => r.id === m.id)),
          ...(streamingText
            ? [
                {
                  id: "__streaming__",
                  role: "assistant" as const,
                  content: streamingText,
                  created_at: new Date().toISOString(),
                  streaming: true,
                },
              ]
            : []),
        ]
      : remoteMessages.length > 0
        ? remoteMessages
        : localMessages;

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages.length, streamingText]);

  // Reset local state when session changes
  useEffect(() => {
    setLocalMessages([]);
    setStreamingText("");
    setIsStreaming(false);
  }, [activeSessionId]);

  // Focus textarea
  useEffect(() => {
    if (activeSessionId !== null) {
      setTimeout(() => textareaRef.current?.focus(), 80);
    }
  }, [activeSessionId]);

  const handleSelectSession = useCallback((id: string) => {
    setActiveSessionId(id);
  }, []);

  const handleNewChat = useCallback(() => {
    abortRef.current?.abort();
    setActiveSessionId(null);
    setLocalMessages([]);
    setStreamingText("");
    setIsStreaming(false);
    setInputText("");
  }, []);

  const handleDeleteSession = useCallback(
    async (id: string) => {
      await deleteSession.mutateAsync(id);
      if (activeSessionId === id) handleNewChat();
    },
    [deleteSession, activeSessionId, handleNewChat],
  );

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isStreaming) return;
    setInputText("");

    let sessionId = activeSessionId;

    if (!sessionId) {
      const firstWords = text.split(/\s+/).slice(0, 6).join(" ");
      const newSession = await createSession.mutateAsync({
        title: firstWords.length < text.length ? `${firstWords}…` : firstWords,
      });
      sessionId = newSession.id;
      setActiveSessionId(sessionId);
    }

    const userMsg: Message = {
      id: `opt-${Date.now()}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, userMsg]);

    setIsStreaming(true);
    setStreamingText("");
    abortRef.current = new AbortController();

    try {
      const res = await fetch(
        `${WORKER_URL}/v1/chat/sessions/${sessionId}/stream`,
        {
          method: "POST",
          signal: abortRef.current.signal,
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            message: text,
            ...(contextSymbol ? { context: { symbol: contextSymbol } } : {}),
          }),
        },
      );

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const chunk = line.slice(6);
            if (chunk === "[DONE]") break;
            setStreamingText((prev) => prev + chunk);
          }
        }
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        const errMsg: Message = {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
          created_at: new Date().toISOString(),
        };
        setLocalMessages((prev) => [...prev, errMsg]);
      }
    } finally {
      setIsStreaming(false);
      setStreamingText("");
    }
  }, [inputText, isStreaming, activeSessionId, createSession, token, contextSymbol]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isMac = navigator.platform.toUpperCase().includes("MAC");
    const isSubmit = (isMac ? e.metaKey : e.ctrlKey) && e.key === "Enter";
    if (isSubmit) {
      e.preventDefault();
      handleSend();
      return;
    }
    // Also plain Enter (no shift) on single-line input
    if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-3rem)] overflow-hidden -m-4">
        {/* ── Left sidebar ── */}
        <aside className="hidden md:flex w-[280px] shrink-0 flex-col border-r bg-background">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <span className="text-sm font-semibold">AI Assistant</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={handleNewChat}
              aria-label="New conversation"
              title="New conversation"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-0.5">
              {sessionsLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />
                ))
              ) : sessions.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground space-y-3">
                  <Bot className="mx-auto h-8 w-8 opacity-30" />
                  <p>No conversations yet</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => textareaRef.current?.focus()}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Start chatting
                  </Button>
                </div>
              ) : (
                sessions.map((s) => (
                  <SessionItem
                    key={s.id}
                    session={s}
                    active={s.id === activeSessionId}
                    onSelect={() => handleSelectSession(s.id)}
                    onDelete={() => handleDeleteSession(s.id)}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </aside>

        {/* ── Main chat area ── */}
        <main className="flex flex-1 flex-col overflow-hidden bg-muted/10">
          {/* Chat header */}
          <div className="flex h-12 shrink-0 items-center border-b px-4 gap-3 bg-background">
            <Bot className="h-4 w-4 text-purple-500 shrink-0" />
            <span className="text-sm font-medium text-foreground">
              {sessions.find((s) => s.id === activeSessionId)?.title ||
                "New Conversation"}
            </span>
            {contextSymbol && (
              <Badge variant="secondary" className="text-[10px] h-5 gap-1 ml-1">
                <span className="opacity-60">Symbol:</span>
                <span className="font-mono font-semibold">{contextSymbol}</span>
              </Badge>
            )}
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1">
            {msgsLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : displayMessages.length === 0 ? (
              <EmptyState onHintClick={(hint) => { setInputText(hint); textareaRef.current?.focus(); }} />
            ) : (
              <div className="py-4 max-w-3xl mx-auto">
                {displayMessages.map((msg) => (
                  <MessageBubble key={msg.id} msg={msg} />
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="shrink-0 border-t bg-background px-4 py-3">
            <div className="max-w-3xl mx-auto space-y-1.5">
              {contextSymbol && (
                <Badge variant="secondary" className="text-[10px] h-5 gap-1">
                  <span className="opacity-60">Using symbol:</span>
                  <span className="font-mono font-semibold">{contextSymbol}</span>
                </Badge>
              )}
              <div className="flex items-end gap-3 rounded-xl border bg-muted/30 px-4 py-3 focus-within:border-purple-500 transition-colors">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about markets, your portfolio, or any trading question…"
                  disabled={isStreaming}
                  className="flex-1 min-h-0 max-h-[160px] resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground leading-relaxed"
                  style={{ fieldSizing: "content" } as React.CSSProperties}
                />
                <Button
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 text-white hover:opacity-90"
                  disabled={!inputText.trim() || isStreaming}
                  onClick={handleSend}
                  aria-label="Send message"
                >
                  {isStreaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-center text-[10px] text-muted-foreground">
                {navigator.platform.toUpperCase().includes("MAC") ? "⌘" : "Ctrl"}+Enter to send · Shift+Enter for new line · Grounded in live market data
              </p>
            </div>
          </div>
        </main>
      </div>
    </DashboardLayout>
  );
}

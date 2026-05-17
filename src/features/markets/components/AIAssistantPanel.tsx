/**
 * AIAssistantPanel — collapsible floating AI chat panel (bottom-right corner).
 *
 * Features:
 *  - Floating trigger button (56 px, gradient, bot icon)
 *  - Expanded glass-morphism panel (400×600, mobile full-screen)
 *  - Session sidebar (slides over body)
 *  - Message list with streaming assistant bubble + cursor animation
 *  - Markdown rendering via MarkdownMessage
 *  - Context badge from localStorage or `symbol` prop
 *  - Auto-scroll to bottom
 *  - Creates session on first send if none active
 */

import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
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
import { MarkdownMessage } from "./MarkdownMessage";
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

// ── Props ─────────────────────────────────────────────────────────────────────

interface AIAssistantPanelProps {
  symbol?: string;
}

// ── Timestamp helper ──────────────────────────────────────────────────────────

function relativeTime(iso: string) {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

// ── Message bubble ─────────────────────────────────────────────────────────────

function MessageBubble({
  msg,
}: {
  msg: Message & { streaming?: boolean };
}) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-2.5 px-3 py-2", isUser ? "flex-row-reverse" : "")}>
      {/* Avatar */}
      <div
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full mt-0.5",
          isUser
            ? "bg-blue-600 text-white"
            : "bg-muted text-muted-foreground",
        )}
      >
        {isUser ? (
          <span className="text-[10px] font-bold select-none">You</span>
        ) : (
          <Bot className="h-3.5 w-3.5" />
        )}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          "flex max-w-[82%] flex-col gap-1",
          isUser ? "items-end" : "items-start",
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-3 py-2 text-sm leading-relaxed",
            isUser
              ? "bg-blue-600 text-white rounded-tr-sm"
              : "bg-muted/80 text-foreground rounded-tl-sm",
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
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium leading-tight">{session.title || "New conversation"}</p>
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

// ── Main component ────────────────────────────────────────────────────────────

export function AIAssistantPanel({ symbol: symbolProp }: AIAssistantPanelProps) {
  const { session: authSession } = useAuth() as any;
  const token: string | undefined = authSession?.access_token;

  const [isOpen, setIsOpen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<(Message & { streaming?: boolean })[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [inputText, setInputText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { data: sessions = [] } = useChatSessions();
  const { data: remoteMessages = [], isLoading: msgsLoading } = useChatMessages(activeSessionId);
  const createSession = useCreateSession();
  const deleteSession = useDeleteSession();

  // Detect symbol from prop or localStorage
  const [contextSymbol, setContextSymbol] = useState<string | null>(null);
  useEffect(() => {
    if (symbolProp) {
      setContextSymbol(symbolProp);
      return;
    }
    const stored = localStorage.getItem("lnai_terminal_symbol");
    if (stored) setContextSymbol(stored);
  }, [symbolProp, isOpen]);

  // Merge remote messages with any local streaming state
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

  // Focus textarea when panel opens
  useEffect(() => {
    if (isOpen && !showSidebar) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen, showSidebar, activeSessionId]);

  // When session changes, reset local messages
  useEffect(() => {
    setLocalMessages([]);
    setStreamingText("");
    setIsStreaming(false);
  }, [activeSessionId]);

  const handleSelectSession = useCallback((id: string) => {
    setActiveSessionId(id);
    setShowSidebar(false);
  }, []);

  const handleNewChat = useCallback(() => {
    setActiveSessionId(null);
    setLocalMessages([]);
    setStreamingText("");
    setIsStreaming(false);
    setShowSidebar(false);
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

    // Create session if needed
    if (!sessionId) {
      const firstWords = text.split(/\s+/).slice(0, 6).join(" ");
      const newSession = await createSession.mutateAsync({
        title: firstWords.length < text.length ? `${firstWords}…` : firstWords,
      });
      sessionId = newSession.id;
      setActiveSessionId(sessionId);
    }

    // Optimistic user message
    const userMsg: Message = {
      id: `opt-${Date.now()}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, userMsg]);

    // Stream
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
            if (chunk === "[DONE]") {
              break;
            }
            setStreamingText((prev) => prev + chunk);
          }
        }
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        const errMsg: Message = {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClose = () => {
    abortRef.current?.abort();
    setIsOpen(false);
    setShowSidebar(false);
  };

  // ── Collapsed trigger button ─────────────────────────────────────────────

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open AI Markets Assistant"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2"
      >
        <Bot className="h-6 w-6" />
        {sessions.length > 0 && (
          <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-green-400 border-2 border-background" />
        )}
      </button>
    );
  }

  // ── Expanded panel ───────────────────────────────────────────────────────

  return (
    <div
      className={cn(
        "fixed z-50 bottom-6 right-6",
        "w-[400px] h-[600px]",
        "max-sm:bottom-0 max-sm:right-0 max-sm:left-0 max-sm:top-0 max-sm:w-full max-sm:h-full max-sm:rounded-none",
        "flex flex-col overflow-hidden",
        "bg-background/95 backdrop-blur-lg border rounded-2xl shadow-2xl",
      )}
    >
      {/* ── Header ── */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white shrink-0">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <span className="flex-1 text-sm font-semibold truncate">AI Markets Assistant</span>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => setShowSidebar((v) => !v)}
          aria-label="Toggle session list"
          title="Sessions"
        >
          {showSidebar ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={handleClose}
          aria-label="Close assistant"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Body ── */}
      <div className="relative flex-1 overflow-hidden">
        {/* Session sidebar */}
        <div
          className={cn(
            "absolute inset-0 z-10 flex flex-col bg-background transition-transform duration-200",
            showSidebar ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Conversations
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-xs"
              onClick={handleNewChat}
            >
              <Plus className="h-3.5 w-3.5" />
              New chat
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-0.5">
              {sessions.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground space-y-2">
                  <Bot className="mx-auto h-7 w-7 opacity-30" />
                  <p>No conversations yet</p>
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
        </div>

        {/* Messages */}
        <ScrollArea className="h-full">
          <div className="py-3">
            {!activeSessionId && displayMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[400px] gap-4 px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20">
                  <Sparkles className="h-7 w-7 text-purple-500" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold">AI Markets Assistant</p>
                  <p className="text-xs text-muted-foreground">
                    Ask about markets, your portfolio, trading strategies, or any financial question.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {[
                    "What's the NIFTY 50 outlook?",
                    "Analyse RELIANCE fundamentals",
                    "Best sectors to watch now?",
                    "Explain F&O open interest",
                  ].map((hint) => (
                    <button
                      key={hint}
                      type="button"
                      onClick={() => setInputText(hint)}
                      className="rounded-full border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:border-purple-500 hover:text-purple-500 transition-colors"
                    >
                      {hint}
                    </button>
                  ))}
                </div>
              </div>
            ) : msgsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              displayMessages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </div>

      {/* ── Footer ── */}
      <div className="shrink-0 border-t bg-background px-3 py-2.5 space-y-1.5">
        {contextSymbol && (
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px] h-5 gap-1">
              <span className="opacity-60">Using symbol:</span>
              <span className="font-mono font-semibold">{contextSymbol}</span>
            </Badge>
          </div>
        )}

        <div className="flex items-end gap-2 rounded-xl border bg-muted/30 px-3 py-2 focus-within:border-purple-500 transition-colors">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about markets…"
            disabled={isStreaming}
            className={cn(
              "flex-1 min-h-0 max-h-[96px] resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground",
              "scrollbar-thin",
            )}
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          <Button
            size="icon"
            className="h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 text-white hover:opacity-90"
            disabled={!inputText.trim() || isStreaming}
            onClick={handleSend}
            aria-label="Send message"
          >
            {isStreaming ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        <p className="text-center text-[10px] text-muted-foreground">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

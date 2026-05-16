/**
 * Markets — AI Research Threads
 *
 * Route: /dashboard/markets/research
 * URL state: ?thread=<id>  — selects the active thread
 *
 * Layout:
 *   ┌──────────────┬───────────────────────────────────────────┐
 *   │ Thread list  │  Chat area                                │
 *   │  + New       │  messages + bottom input                  │
 *   └──────────────┴───────────────────────────────────────────┘
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { formatDistanceToNow } from "date-fns";
import {
  Archive, Bot, Brain, ChevronDown, Loader2,
  MessageSquare, MoreVertical, PenLine, Plus, Send, User,
} from "lucide-react";
import { toast } from "sonner";

import {
  useCreateThread,
  useResearchMessages,
  useResearchThreads,
  useSendMessage,
  useUpdateThread,
} from "../hooks/useResearchThreads";
import { usePortfolios } from "../hooks/usePortfolios";
import type { CreateThreadInput, ResearchContextType, ResearchThread } from "../types";

import { Avatar, AvatarFallback }                 from "@/components/ui/avatar";
import { Badge }                                   from "@/components/ui/badge";
import { Button }                                  from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter,
  DialogHeader, DialogTitle,
}                                                  from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
}                                                  from "@/components/ui/dropdown-menu";
import { Input }                                   from "@/components/ui/input";
import { Label }                                   from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
}                                                  from "@/components/ui/select";
import { Textarea }                                from "@/components/ui/textarea";
import { Skeleton }                                from "@/components/ui/skeleton";
import { ScrollArea }                              from "@/components/ui/scroll-area";
import { cn }                                      from "@/lib/utils";

// ── Cost formatting ────────────────────────────────────────────────────────

function formatCost(costUsd: number | null): string {
  if (costUsd === null) return "";
  if (costUsd < 0.001) return "<$0.001";
  return `$${costUsd.toFixed(4)}`;
}

// ── New thread dialog ──────────────────────────────────────────────────────

interface NewThreadDialogProps {
  open:    boolean;
  onClose: () => void;
  onCreate: (input: CreateThreadInput) => void;
  loading: boolean;
}

function NewThreadDialog({ open, onClose, onCreate, loading }: NewThreadDialogProps) {
  const [title,       setTitle]       = useState("");
  const [contextType, setContextType] = useState<ResearchContextType | "">("");
  const [refId,       setRefId]       = useState("");

  const { data: portfolios = [] } = usePortfolios();

  const handleSubmit = () => {
    onCreate({
      title:          title.trim() || undefined,
      context_type:   (contextType as ResearchContextType) || undefined,
      context_ref_id: refId || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New research thread</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="rt-title">Title <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              id="rt-title"
              placeholder="e.g. HDFC Bank Q4 outlook"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !loading && handleSubmit()}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rt-ctx">Context</Label>
            <Select value={contextType} onValueChange={v => { setContextType(v as ResearchContextType); setRefId(""); }}>
              <SelectTrigger id="rt-ctx">
                <SelectValue placeholder="General (no context)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General — no specific context</SelectItem>
                <SelectItem value="portfolio">Portfolio — analyse my holdings</SelectItem>
                <SelectItem value="watchlist">Watchlist</SelectItem>
                <SelectItem value="instrument">Specific instrument</SelectItem>
                <SelectItem value="sector">Sector / theme</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {contextType === "portfolio" && portfolios.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="rt-portfolio">Portfolio</Label>
              <Select value={refId} onValueChange={setRefId}>
                <SelectTrigger id="rt-portfolio">
                  <SelectValue placeholder="Select a portfolio" />
                </SelectTrigger>
                <SelectContent>
                  {portfolios.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {contextType === "instrument" && (
            <div className="space-y-2">
              <Label htmlFor="rt-symbol">Symbol</Label>
              <Input
                id="rt-symbol"
                placeholder="e.g. RELIANCE"
                value={refId}
                onChange={e => setRefId(e.target.value.toUpperCase())}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create thread
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Thread list item ───────────────────────────────────────────────────────

function ThreadItem({
  thread, active, onClick, onArchive, onRename,
}: {
  thread:    ResearchThread;
  active:    boolean;
  onClick:   () => void;
  onArchive: (id: string) => void;
  onRename:  (thread: ResearchThread) => void;
}) {
  const timeAgo = thread.last_message_at
    ? formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: true })
    : formatDistanceToNow(new Date(thread.created_at), { addSuffix: true });

  const ctxLabel: Record<string, string> = {
    portfolio: "Portfolio", watchlist: "Watchlist",
    instrument: "Instrument", sector: "Sector", general: "General",
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => e.key === "Enter" && onClick()}
      className={cn(
        "group relative flex cursor-pointer flex-col gap-0.5 rounded-md px-3 py-2.5 text-sm transition-colors select-none",
        active
          ? "bg-primary/10 text-primary"
          : "hover:bg-muted/60 text-foreground",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-1 font-medium leading-tight">{thread.title}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost" size="icon"
              className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100"
              onClick={e => e.stopPropagation()}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(thread); }}>
              <PenLine className="mr-2 h-3.5 w-3.5" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => { e.stopPropagation(); onArchive(thread.id); }}
            >
              <Archive className="mr-2 h-3.5 w-3.5" /> Archive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {thread.context_type && thread.context_type !== "general" && (
          <Badge variant="secondary" className="h-4 px-1 text-[10px]">
            {ctxLabel[thread.context_type]}
          </Badge>
        )}
        <span className="line-clamp-1">{timeAgo}</span>
        {thread.message_count > 0 && (
          <span className="ml-auto shrink-0">
            <MessageSquare className="inline h-3 w-3 mr-0.5" />
            {thread.message_count}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Chat message bubble ────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: { id: string; role: string; content: string; is_error: boolean; llm_model: string | null; input_tokens: number | null; output_tokens: number | null; cost_usd: number | null } }) {
  const isUser = msg.role === "user";
  const isOptimistic = msg.id.startsWith("optimistic-");

  return (
    <div className={cn("flex gap-3 px-4 py-3", isUser ? "flex-row-reverse" : "")}>
      {/* Avatar */}
      <Avatar className="h-7 w-7 shrink-0 mt-0.5">
        <AvatarFallback className={cn(
          "text-[11px]",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}>
          {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
        </AvatarFallback>
      </Avatar>

      {/* Bubble */}
      <div className={cn("flex max-w-[80%] flex-col gap-1", isUser ? "items-end" : "items-start")}>
        <div className={cn(
          "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : msg.is_error
              ? "bg-destructive/10 text-destructive border border-destructive/20 rounded-tl-sm"
              : "bg-muted text-foreground rounded-tl-sm",
          isOptimistic && "opacity-60",
        )}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_pre]:my-2 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Meta: model + cost */}
        {!isUser && !isOptimistic && (msg.llm_model || msg.cost_usd !== null) && (
          <div className="flex items-center gap-2 px-1 text-[10px] text-muted-foreground">
            {msg.llm_model && <span>{msg.llm_model}</span>}
            {msg.input_tokens != null && msg.output_tokens != null && (
              <span>{msg.input_tokens}↑ {msg.output_tokens}↓</span>
            )}
            {msg.cost_usd !== null && <span>{formatCost(msg.cost_usd)}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Thinking indicator ─────────────────────────────────────────────────────

function ThinkingBubble() {
  return (
    <div className="flex gap-3 px-4 py-3">
      <Avatar className="h-7 w-7 shrink-0 mt-0.5">
        <AvatarFallback className="bg-muted text-muted-foreground text-[11px]">
          <Bot className="h-3.5 w-3.5" />
        </AvatarFallback>
      </Avatar>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
        {[0, 150, 300].map(delay => (
          <span
            key={delay}
            className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Empty chat state ───────────────────────────────────────────────────────

function EmptyChat({ thread }: { thread: ResearchThread }) {
  const ctxHints: Record<string, string[]> = {
    portfolio: [
      "What's the overall P&L of my portfolio?",
      "Which holding has performed best this year?",
      "Show me the sector allocation breakdown.",
      "Are there any underperforming positions I should review?",
    ],
    general: [
      "What's the outlook for NIFTY 50 this quarter?",
      "Compare HDFC Bank and ICICI Bank on key metrics.",
      "Explain what the RBI rate decision means for equity markets.",
      "What are the best performing sectors in India this year?",
    ],
  };
  const hints = ctxHints[thread.context_type ?? "general"] ?? ctxHints.general;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <Brain className="h-7 w-7 text-primary" />
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-foreground">{thread.title}</p>
        <p className="text-sm text-muted-foreground">
          Ask anything about Indian markets, your portfolio, or specific instruments.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {hints.map(hint => (
          <button
            key={hint}
            className="rounded-full border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            {hint}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Rename dialog ──────────────────────────────────────────────────────────

function RenameDialog({ thread, onClose, onSave, loading }: {
  thread: ResearchThread; onClose: () => void; onSave: (title: string) => void; loading: boolean;
}) {
  const [title, setTitle] = useState(thread.title);
  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Rename thread</DialogTitle></DialogHeader>
        <Input value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && !loading && onSave(title)} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={() => onSave(title.trim())} disabled={!title.trim() || loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function ResearchThreadsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedThreadId = searchParams.get("thread") ?? undefined;

  const [newThreadOpen, setNewThreadOpen]   = useState(false);
  const [renameThread,  setRenameThread]    = useState<ResearchThread | null>(null);
  const [input,         setInput]           = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: threads = [], isLoading: threadsLoading } = useResearchThreads();
  const { data: messages = [], isLoading: msgsLoading }   = useResearchMessages(selectedThreadId);
  const createThread = useCreateThread();
  const sendMessage  = useSendMessage();
  const updateThread = useUpdateThread();

  const activeThread = threads.find(t => t.id === selectedThreadId) ?? null;

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sendMessage.isPending]);

  // Auto-focus textarea when thread changes
  useEffect(() => {
    if (selectedThreadId) textareaRef.current?.focus();
  }, [selectedThreadId]);

  const selectThread = useCallback((id: string) => {
    setSearchParams(p => { p.set("thread", id); return p; }, { replace: true });
  }, [setSearchParams]);

  const handleCreate = async (input: CreateThreadInput) => {
    try {
      const thread = await createThread.mutateAsync(input);
      setNewThreadOpen(false);
      selectThread(thread.id);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create thread");
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !selectedThreadId || sendMessage.isPending) return;
    const content = input.trim();
    setInput("");
    try {
      await sendMessage.mutateAsync({ thread_id: selectedThreadId, content });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to send message");
      setInput(content); // restore input on error
    }
  };

  const handleArchive = async (threadId: string) => {
    try {
      await updateThread.mutateAsync({ id: threadId, status: "archived" });
      if (selectedThreadId === threadId) setSearchParams({});
      toast.success("Thread archived");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to archive thread");
    }
  };

  const handleRename = async (title: string) => {
    if (!renameThread) return;
    try {
      await updateThread.mutateAsync({ id: renameThread.id, title });
      setRenameThread(null);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to rename thread");
    }
  };

  // Hint click fills the input
  const handleHintClick = (hint: string) => {
    setInput(hint);
    textareaRef.current?.focus();
  };

  return (
    <DashboardLayout>
    <div className="flex h-[calc(100vh-3rem)] overflow-hidden">

      {/* ── Left panel: thread list ──────────────────────────────────── */}
      <aside className="hidden md:flex w-[260px] shrink-0 flex-col border-r bg-background">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">AI Research</span>
          </div>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setNewThreadOpen(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {threadsLoading
              ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-md" />)
              : threads.length === 0
                ? (
                  <div className="py-12 text-center text-sm text-muted-foreground space-y-2">
                    <Brain className="mx-auto h-8 w-8 text-muted-foreground/40" />
                    <p>No research threads yet</p>
                    <Button size="sm" variant="outline" onClick={() => setNewThreadOpen(true)}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> New thread
                    </Button>
                  </div>
                )
                : threads.map(t => (
                  <ThreadItem
                    key={t.id}
                    thread={t}
                    active={t.id === selectedThreadId}
                    onClick={() => selectThread(t.id)}
                    onArchive={handleArchive}
                    onRename={setRenameThread}
                  />
                ))
            }
          </div>
        </ScrollArea>
      </aside>

      {/* ── Right panel: chat ────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {!activeThread ? (
          // No thread selected
          <div className="flex h-full flex-col items-center justify-center gap-5 text-center px-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Brain className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold">AI Research</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Chat with an AI analyst grounded in your portfolio data and live Indian market news.
              </p>
            </div>
            <Button onClick={() => setNewThreadOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> New research thread
            </Button>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Brain className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate text-sm font-medium">{activeThread.title}</span>
                {activeThread.context_type && activeThread.context_type !== "general" && (
                  <Badge variant="secondary" className="hidden sm:inline-flex shrink-0 text-[10px]">
                    {activeThread.context_type}
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" className="h-7 md:hidden" onClick={() => setSearchParams({})}>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1">
              {msgsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <EmptyChat thread={activeThread} />
              ) : (
                <div className="py-4">
                  {messages.map(msg => (
                    <MessageBubble key={msg.id} msg={msg} />
                  ))}
                  {sendMessage.isPending && <ThinkingBubble />}
                  <div ref={bottomRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <div className="border-t bg-background px-4 py-3 shrink-0">
              <div className="flex items-end gap-2 rounded-xl border bg-muted/30 px-3 py-2 focus-within:border-primary transition-colors">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask about your portfolio or Indian markets…"
                  rows={1}
                  className="max-h-40 min-h-0 resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  disabled={sendMessage.isPending}
                />
                <Button
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-lg"
                  disabled={!input.trim() || sendMessage.isPending}
                  onClick={handleSend}
                >
                  {sendMessage.isPending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Send className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
                Enter to send · Shift+Enter for new line · Grounded in live market data
              </p>
            </div>
          </>
        )}
      </main>

      {/* Dialogs */}
      <NewThreadDialog
        open={newThreadOpen}
        onClose={() => setNewThreadOpen(false)}
        onCreate={handleCreate}
        loading={createThread.isPending}
      />
      {renameThread && (
        <RenameDialog
          thread={renameThread}
          onClose={() => setRenameThread(null)}
          onSave={handleRename}
          loading={updateThread.isPending}
        />
      )}
    </div>
    </DashboardLayout>
  );
}

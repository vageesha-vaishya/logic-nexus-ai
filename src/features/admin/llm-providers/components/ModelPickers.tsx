import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";

import { useProviderModels, type ProviderModel } from "../hooks/useProviderModels";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { GEMINI_KNOWN_MODELS, GEMINI_CUSTOM_SENTINEL } from "../constants";

// ─── Gemini model picker ───────────────────────────────────────────────
//
// Curated Select of known-good Gemini models on the v1beta generateContent
// endpoint. Prevents the failure mode that hit us 2026-05-27: a tenant
// saved `gemini-1.5-flash-002` (deprecated) and every brief 404'd at
// call time. The "Custom…" option preserves the escape hatch — paste any
// model id (useful when Google ships a new one before this list is updated).

export function GeminiModelPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  // If the saved value isn't in the known list and isn't empty, surface it
  // as a Custom selection so the user sees what they have and can edit it.
  const isKnown = (GEMINI_KNOWN_MODELS as readonly string[]).includes(value);
  const [mode, setMode] = useState<"known" | "custom">(
    !value || isKnown ? "known" : "custom",
  );

  return (
    <div className="space-y-1.5">
      <Select
        value={mode === "custom" ? GEMINI_CUSTOM_SENTINEL : value || GEMINI_KNOWN_MODELS[0]}
        onValueChange={(v) => {
          if (v === GEMINI_CUSTOM_SENTINEL) {
            setMode("custom");
            // Don't wipe the existing custom value; only seed if empty.
            if (!value) onChange("");
          } else {
            setMode("known");
            onChange(v);
          }
        }}
      >
        <SelectTrigger className="font-mono">
          <SelectValue placeholder="Pick a Gemini model" />
        </SelectTrigger>
        <SelectContent>
          {GEMINI_KNOWN_MODELS.map((m) => (
            <SelectItem key={m} value={m} className="font-mono">{m}</SelectItem>
          ))}
          <SelectItem value={GEMINI_CUSTOM_SENTINEL}>Custom…</SelectItem>
        </SelectContent>
      </Select>
      {mode === "custom" && (
        <Input
          className="font-mono"
          autoComplete="off"
          placeholder="e.g. gemini-3.0-flash-preview"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

// ─── OpenRouter model picker ───────────────────────────────────────────
//
// Searchable combobox over the live OpenRouter catalog (https://openrouter.ai/api/v1/models).
// Falls back to free-text on fetch failure so a stale catalog never blocks setup.

export function OpenRouterModelPicker({
  value,
  onChange,
  baseUrl,
}: {
  value: string;
  onChange: (next: string) => void;
  baseUrl?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const models = useProviderModels("openrouter", baseUrl);

  const selected = useMemo<ProviderModel | undefined>(
    () => models.data?.find((m) => m.id === value),
    [models.data, value],
  );

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-mono text-left"
          >
            <span className="truncate">
              {value || <span className="text-muted-foreground">Pick a model…</span>}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[24rem] p-0" align="start">
          <Command
            filter={(itemValue, search) => {
              // Custom filter: match against id AND name in lowercase.
              const q = search.toLowerCase();
              return itemValue.toLowerCase().includes(q) ? 1 : 0;
            }}
          >
            <CommandInput
              placeholder="Search models (e.g. claude, gpt-4o, gemini)…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList className="max-h-80">
              {models.isPending && (
                <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Loading OpenRouter catalog…
                </div>
              )}
              {models.isError && (
                <div className="space-y-2 p-4 text-sm">
                  <p className="text-destructive">Failed to load model list.</p>
                  <p className="text-xs text-muted-foreground">
                    {(models.error as Error)?.message ?? "Unknown error"}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => models.refetch()}
                  >
                    Retry
                  </Button>
                  <p className="pt-1 text-xs text-muted-foreground">
                    You can still type a model id manually below.
                  </p>
                  <Input
                    className="font-mono"
                    placeholder="anthropic/claude-3.5-sonnet"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                  />
                </div>
              )}
              {models.isSuccess && (
                <>
                  <CommandEmpty>
                    <div className="space-y-2 px-4 py-3 text-sm">
                      <p className="text-muted-foreground">No models match "{query}".</p>
                      {query && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            onChange(query.trim());
                            setOpen(false);
                          }}
                        >
                          Use "{query.trim()}" anyway
                        </Button>
                      )}
                    </div>
                  </CommandEmpty>
                  <CommandGroup>
                    {(models.data ?? []).map((m) => (
                      <CommandItem
                        key={m.id}
                        value={`${m.id} ${m.name}`}
                        onSelect={() => {
                          onChange(m.id);
                          setOpen(false);
                        }}
                        className="flex flex-col items-start gap-0.5"
                      >
                        <div className="flex w-full items-center gap-2">
                          <Check
                            className={cn(
                              "h-4 w-4 shrink-0",
                              value === m.id ? "opacity-100" : "opacity-0",
                            )}
                            aria-hidden="true"
                          />
                          <span className="font-mono text-sm">{m.id}</span>
                        </div>
                        <div className="ml-6 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          {m.name && m.name !== m.id && <span>{m.name}</span>}
                          {m.contextLength != null && (
                            <span>{formatContext(m.contextLength)} ctx</span>
                          )}
                          {m.pricePromptPerMillion != null && (
                            <span>
                              ${m.pricePromptPerMillion.toFixed(2)} / $
                              {m.priceCompletionPerMillion?.toFixed(2) ?? "?"} per 1M
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected && (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {selected.name && selected.name !== selected.id && <span>{selected.name}</span>}
            {selected.contextLength != null && (
              <span>{formatContext(selected.contextLength)} context</span>
            )}
            {selected.pricePromptPerMillion != null && (
              <span>
                ${selected.pricePromptPerMillion.toFixed(2)} prompt / $
                {selected.priceCompletionPerMillion?.toFixed(2) ?? "?"} completion (per 1M tokens)
              </span>
            )}
          </div>
          {selected.description && (
            <p className="mt-1 line-clamp-2">{selected.description}</p>
          )}
        </div>
      )}
    </div>
  );
}

function formatContext(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 0)}K`;
  return String(n);
}

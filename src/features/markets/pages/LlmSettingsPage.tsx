/**
 * Markets — LLM provider settings page.
 *
 * Route: /dashboard/markets/settings/llm
 *
 * Per-tenant LLM provider configuration (ADR-024 + the 2026-05-15 per-tenant
 * decision). tenant_admin / franchise_admin / platform_admin can:
 *   • List configured providers (no keys exposed)
 *   • Add a new provider with API key (stored in vault)
 *   • Mark one as default (the Gateway uses default for all markets tasks)
 *   • Rotate the API key on an existing config
 *   • Delete a config
 *
 * UI built entirely on ADR-026 primitives.
 */

import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  Brain,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  KeyRound,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";

import {
  useLlmConfigs,
  useSaveLlmConfig,
  useDeleteLlmConfig,
  defaultModelFor,
} from "../hooks/useLlmConfigs";
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
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import {
  EmptyState,
  ErrorState,
  SkeletonRow,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Switch,
} from "@/design-system";
import type {
  CreateLlmConfigInput,
  LlmProviderConfig,
  LlmProviderKind,
} from "../types";

const PROVIDER_LABELS: Record<LlmProviderKind, string> = {
  anthropic: "Anthropic Claude",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  gemini: "Google Gemini",
  "local-qwen": "Local Qwen",
  custom: "Custom (OpenAI-compatible)",
};

const PROVIDER_HINT: Record<LlmProviderKind, string> = {
  anthropic:   "Direct Claude API. Get a key at console.anthropic.com.",
  openrouter:  "One key, many models. Models named like 'anthropic/claude-3.5-sonnet'. Get a key at openrouter.ai/keys.",
  openai:      "OpenAI native API.",
  gemini:      "Google Gemini API. Get a key at aistudio.google.com/apikey.",
  "local-qwen":"Your local Qwen server (must speak OpenAI chat-completions). Set base_url.",
  custom:      "Any OpenAI-compatible chat-completions endpoint. Set base_url and a model name the upstream understands.",
};

/**
 * Known-good Gemini models on the v1beta `generateContent` endpoint as of
 * 2026-05. Surfaced as a Select to prevent users from typing a retired
 * model name (e.g. `gemini-1.5-flash-002`) and hitting a 404 at
 * generation time. The "Custom…" sentinel lets power users still paste
 * any model id (e.g. a newly-released model not yet on this list).
 */
const GEMINI_KNOWN_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro",
] as const;
const GEMINI_CUSTOM_SENTINEL = "__custom__";

export default function LlmSettingsPage() {
  const configs = useLlmConfigs();
  const [editing, setEditing] = useState<LlmProviderConfig | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <DashboardLayout>
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Sparkles className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            LLM Providers
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Configure which LLM provider + API key the markets domain uses for AI briefs,
            sentiment scoring, and research. Keys are stored encrypted in Supabase Vault and
            never returned to the browser.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Add provider
        </Button>
      </header>

      {configs.isPending && (
        <div className="rounded-lg border p-4 space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <SkeletonRow key={i} columns={4} />
          ))}
        </div>
      )}

      {configs.isError && (
        <ErrorState
          title="Failed to load LLM configs"
          message={configs.error?.message ?? "Unknown error"}
          onRetry={() => configs.refetch()}
        />
      )}

      {configs.isSuccess && configs.data.length === 0 && (
        <EmptyState
          icon={<Brain className="h-10 w-10" />}
          title="No LLM provider configured"
          description="Markets-domain AI features (briefs, sentiment, research) need an LLM provider. Add OpenRouter for a single key across many models, or any other provider you have a key for."
          actionLabel="Add provider"
          onAction={() => setCreateOpen(true)}
        />
      )}

      {configs.isSuccess && configs.data.length > 0 && (
        <ul className="space-y-3">
          {configs.data.map((cfg) => (
            <li key={cfg.id}>
              <LlmConfigRow
                config={cfg}
                onEdit={() => setEditing(cfg)}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Create sheet */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Add LLM provider</SheetTitle>
          </SheetHeader>
          <LlmConfigForm mode="create" onDone={() => setCreateOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Edit sheet */}
      <Sheet open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Edit provider</SheetTitle>
          </SheetHeader>
          {editing && (
            <LlmConfigForm
              mode="edit"
              existing={editing}
              onDone={() => setEditing(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
    </DashboardLayout>
  );
}

// ─── Row ───────────────────────────────────────────────────────────────

function LlmConfigRow({
  config,
  onEdit,
}: {
  config: LlmProviderConfig;
  onEdit: () => void;
}) {
  const save = useSaveLlmConfig();
  const del = useDeleteLlmConfig();

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            {PROVIDER_LABELS[config.provider] ?? config.provider}
            {config.is_default && (
              <Badge variant="default" className="text-xs">
                <CheckCircle2 className="mr-0.5 h-3 w-3" aria-hidden="true" />
                Default
              </Badge>
            )}
            {!config.is_active && (
              <Badge variant="secondary" className="text-xs">
                disabled
              </Badge>
            )}
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {config.display_name} · model:{" "}
            <span className="font-mono">{config.default_model}</span>
            {config.base_url && (
              <>
                {" "}
                · <span className="font-mono">{config.base_url}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!config.is_default && (
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await save.mutateAsync({
                    id: config.id,
                    payload: { is_default: true },
                  });
                  toast.success(`${config.display_name} is now the default`);
                } catch (e: any) {
                  toast.error(e?.message ?? "Failed to set default");
                }
              }}
              disabled={save.isPending}
            >
              Set default
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <KeyRound className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              if (!confirm(`Delete "${config.display_name}"? This removes the API key from Vault.`)) return;
              try {
                await del.mutateAsync(config.id);
                toast.success("Provider removed");
              } catch (e: any) {
                toast.error(e?.message ?? "Failed to delete");
              }
            }}
            disabled={del.isPending}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">Delete</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>Added {formatDateTime(config.created_at)}</span>
          {config.last_used_at && <span>Last used {formatRelativeTime(config.last_used_at)}</span>}
          {!config.last_used_at && <span>Not yet used</span>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Form (used by create + edit sheets) ───────────────────────────────

interface FormValues {
  provider: LlmProviderKind;
  display_name: string;
  default_model: string;
  base_url: string;
  api_key: string;
  is_default: boolean;
}

function LlmConfigForm({
  mode,
  existing,
  onDone,
}: {
  mode: "create" | "edit";
  existing?: LlmProviderConfig;
  onDone: () => void;
}) {
  const save = useSaveLlmConfig();
  const isEdit = mode === "edit";

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      provider: existing?.provider ?? "openrouter",
      display_name: existing?.display_name ?? "",
      default_model: existing?.default_model ?? defaultModelFor("openrouter"),
      base_url: existing?.base_url ?? "",
      api_key: "",
      is_default: existing?.is_default ?? !existing,
    },
  });

  const provider = watch("provider");

  const onSubmit = handleSubmit(async (v) => {
    try {
      if (isEdit && existing) {
        // PATCH — only send what changed (+ key if provided)
        const patch: any = {
          display_name: v.display_name.trim(),
          default_model: v.default_model.trim(),
          base_url: v.base_url.trim() || null,
          is_default: v.is_default,
        };
        if (v.api_key && v.api_key.length >= 8) patch.api_key = v.api_key;
        await save.mutateAsync({ id: existing.id, payload: patch });
        toast.success("Provider updated");
      } else {
        const payload: CreateLlmConfigInput = {
          provider: v.provider,
          display_name: v.display_name.trim(),
          default_model: v.default_model.trim(),
          api_key: v.api_key,
          base_url: v.base_url.trim() || undefined,
          is_default: v.is_default,
        };
        await save.mutateAsync({ payload });
        toast.success("Provider added");
      }
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    }
  });

  return (
    // autoComplete="off" + a non-standard "name" + a hidden decoy input below stops Chrome
    // from autofilling the user's email into the base_url / display_name fields, which
    // previously broke the OpenRouter model picker (it concatenated the autofilled email
    // into the fetch URL → /dashboard/settings/<email>/models → 404 from the dev server).
    <form onSubmit={onSubmit} className="mt-4 space-y-4" autoComplete="off">
      {/* Decoy input — Chrome focuses the first text/email field for autofill. */}
      <input
        type="text"
        name="prevent-autofill"
        autoComplete="off"
        tabIndex={-1}
        aria-hidden="true"
        style={{ position: "absolute", height: 0, width: 0, opacity: 0, pointerEvents: "none" }}
      />
      <div className="space-y-1.5">
        <Label htmlFor="provider">Provider</Label>
        <Select
          value={provider}
          onValueChange={(v) => {
            setValue("provider", v as LlmProviderKind);
            // Reset default model when provider changes
            setValue("default_model", defaultModelFor(v));
          }}
          disabled={isEdit /* changing provider would orphan the vault key shape */}
        >
          <SelectTrigger id="provider">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PROVIDER_LABELS) as LlmProviderKind[]).map((p) => (
              <SelectItem key={p} value={p}>
                {PROVIDER_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{PROVIDER_HINT[provider]}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="display_name">Display name</Label>
        <Input
          id="display_name"
          autoComplete="off"
          placeholder="e.g. OpenRouter Personal"
          {...register("display_name", { required: "Display name is required", maxLength: 100 })}
        />
        {errors.display_name && (
          <p className="text-xs text-destructive">{errors.display_name.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="default_model">Default model</Label>
        {provider === "openrouter" ? (
          <OpenRouterModelPicker
            value={watch("default_model")}
            onChange={(v) => setValue("default_model", v, { shouldValidate: true })}
            baseUrl={watch("base_url")}
          />
        ) : provider === "gemini" ? (
          <GeminiModelPicker
            value={watch("default_model")}
            onChange={(v) => setValue("default_model", v, { shouldValidate: true })}
          />
        ) : (
          <Input
            id="default_model"
            className="font-mono"
            autoComplete="off"
            placeholder={defaultModelFor(provider)}
            {...register("default_model", { required: "Default model is required" })}
          />
        )}
        {/* Keep the field registered for validation even when a picker is shown */}
        {(provider === "openrouter" || provider === "gemini") && (
          <input
            type="hidden"
            {...register("default_model", { required: "Default model is required" })}
          />
        )}
        {errors.default_model && (
          <p className="text-xs text-destructive">{errors.default_model.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {provider === "openrouter"
            ? "Searchable catalog of all OpenRouter models with live context-window and pricing. You can also paste any id."
            : provider === "gemini"
              ? "Known-good Gemini models on the v1beta generateContent endpoint. Choose Custom to paste any model id."
              : "Provider-native model name."}
        </p>
      </div>

      {(provider === "openrouter" || provider === "custom" || provider === "local-qwen" || provider === "openai") && (
        <div className="space-y-1.5">
          <Label htmlFor="base_url">Base URL (optional override)</Label>
          <Input
            id="base_url"
            type="url"
            inputMode="url"
            autoComplete="off"
            className="font-mono"
            placeholder={
              provider === "openrouter"  ? "https://openrouter.ai/api/v1" :
              provider === "openai"      ? "https://api.openai.com/v1" :
              provider === "local-qwen"  ? "http://your-qwen-host:8080/v1" :
              "https://your-endpoint/v1"
            }
            {...register("base_url", {
              pattern: {
                value: /^(https?:\/\/.+)?$/i,
                message: "Must be a full URL starting with http:// or https://",
              },
            })}
          />
          {errors.base_url && <p className="text-xs text-destructive">{errors.base_url.message}</p>}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="api_key">
          API key {isEdit && <span className="text-muted-foreground">(leave blank to keep current)</span>}
        </Label>
        <Input
          id="api_key"
          type="password"
          autoComplete="off"
          placeholder={isEdit ? "•••••••• (unchanged)" : "Paste your API key"}
          {...register("api_key", {
            validate: (v) => {
              if (isEdit) return v.length === 0 || v.length >= 8 || "Min 8 characters";
              return v.length >= 8 || "API key is required (min 8 characters)";
            },
          })}
        />
        {errors.api_key && <p className="text-xs text-destructive">{errors.api_key.message}</p>}
        <p className="text-xs text-muted-foreground">
          Stored encrypted in Supabase Vault. Never returned to your browser after submit.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={watch("is_default")}
            onCheckedChange={(checked) => setValue("is_default", Boolean(checked))}
          />
          Use as default
        </label>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" disabled={isSubmitting || save.isPending}>
          {save.isPending ? "Saving…" : isEdit ? "Save changes" : "Add provider"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ─── Gemini model picker ───────────────────────────────────────────────
//
// Curated Select of known-good Gemini models on the v1beta generateContent
// endpoint. Prevents the failure mode that hit us 2026-05-27: a tenant
// saved `gemini-1.5-flash-002` (deprecated) and every brief 404'd at
// call time. The "Custom…" option preserves the escape hatch — paste any
// model id (useful when Google ships a new one before this list is updated).

function GeminiModelPicker({
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

function OpenRouterModelPicker({
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

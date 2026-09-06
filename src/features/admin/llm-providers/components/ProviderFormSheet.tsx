import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { useSaveLlmConfig } from "../hooks/useLlmConfigs";
import {
  Button,
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
import { PROVIDER_LABELS, PROVIDER_HINT, LLM_DOMAINS, DOMAIN_LABELS } from "../constants";
import { GeminiModelPicker, OpenRouterModelPicker } from "./ModelPickers";
import { defaultModelFor } from "../hooks/useLlmConfigs";
import type { CreateLlmConfigInput, LlmDomain, LlmProviderConfig, LlmProviderKind } from "../types";

// ─── Form (used by create + edit) ──────────────────────────────────────

interface FormValues {
  provider: LlmProviderKind;
  display_name: string;
  default_model: string;
  base_url: string;
  api_key: string;
  is_default: boolean;
  domain: LlmDomain | null;
}

export interface ProviderFormSheetProps {
  /** Existing config to edit, or null to create. */
  editing: LlmProviderConfig | null;
  /** Domain pre-selected when creating. null = tenant-wide default. */
  defaultDomain: LlmDomain | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProviderFormSheet({
  editing,
  defaultDomain,
  open,
  onOpenChange,
}: ProviderFormSheetProps) {
  const save = useSaveLlmConfig();
  const isEdit = editing != null;
  const existing = editing ?? undefined;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      provider: existing?.provider ?? "openrouter",
      display_name: existing?.display_name ?? "",
      default_model: existing?.default_model ?? defaultModelFor("openrouter"),
      base_url: existing?.base_url ?? "",
      api_key: "",
      is_default: existing?.is_default ?? !existing,
      domain: existing?.domain ?? defaultDomain,
    },
  });

  // ProviderFormSheet is mounted once by the page shell and toggled via
  // `open`, unlike the old page's two <Sheet> blocks which unmounted (and
  // so re-seeded useForm's defaultValues) on every close. Re-seed explicitly
  // whenever the sheet opens so stale values from a previous edit/create
  // don't leak into the next one.
  useEffect(() => {
    if (!open) return;
    reset({
      provider: existing?.provider ?? "openrouter",
      display_name: existing?.display_name ?? "",
      default_model: existing?.default_model ?? defaultModelFor("openrouter"),
      base_url: existing?.base_url ?? "",
      api_key: "",
      is_default: existing?.is_default ?? !existing,
      domain: existing?.domain ?? defaultDomain,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, defaultDomain]);

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
          domain: v.domain,
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
          domain: v.domain,
        };
        await save.mutateAsync({ payload });
        toast.success("Provider added");
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    }
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{editing === null ? "Add LLM provider" : "Edit provider"}</SheetTitle>
        </SheetHeader>
        {/* autoComplete="off" + a non-standard "name" + a hidden decoy input below stops Chrome
            from autofilling the user's email into the base_url / display_name fields, which
            previously broke the OpenRouter model picker (it concatenated the autofilled email
            into the fetch URL → /dashboard/settings/<email>/models → 404 from the dev server). */}
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
            <Label htmlFor="domain">Domain</Label>
            <Select
              value={watch("domain") ?? "__default__"}
              onValueChange={(v) =>
                setValue("domain", v === "__default__" ? null : (v as LlmDomain))
              }
            >
              <SelectTrigger id="domain">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">Platform default (all domains)</SelectItem>
                {LLM_DOMAINS.map((d) => (
                  <SelectItem key={d} value={d}>{DOMAIN_LABELS[d]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

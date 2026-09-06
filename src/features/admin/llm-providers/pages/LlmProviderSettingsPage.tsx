/**
 * Platform — LLM provider settings page.
 *
 * Route: /dashboard/admin/settings/llm (wired by a later task)
 *
 * Per-tenant, per-domain LLM provider configuration (ADR-024 + the
 * 2026-05-15 per-tenant decision, extended to a per-domain axis). tenant_admin
 * / franchise_admin / platform_admin can, per domain:
 *   • List configured providers (no keys exposed)
 *   • Add a new provider with API key (stored in vault)
 *   • Mark one as default (the Gateway uses default for all tasks in that domain)
 *   • Rotate the API key on an existing config
 *   • Remove a config, reverting that domain to the platform default
 *
 * UI built entirely on ADR-026 primitives.
 */

import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

import { useLlmConfigs } from "../hooks/useLlmConfigs";
import { DomainSection } from "../components/DomainSection";
import { ProviderFormSheet } from "../components/ProviderFormSheet";
import { LLM_DOMAINS } from "../constants";
import { ErrorState, SkeletonRow } from "@/design-system";
import type { LlmDomain, LlmProviderConfig } from "../types";

export default function LlmProviderSettingsPage() {
  const configs = useLlmConfigs();
  const [editing, setEditing] = useState<LlmProviderConfig | null>(null);
  const [createFor, setCreateFor] = useState<LlmDomain | null | undefined>(undefined);

  const byDomain = useMemo(() => {
    const rows = configs.data ?? [];
    return {
      platformDefault: rows.filter((c) => c.domain === null),
      forDomain: (d: LlmDomain) => rows.filter((c) => c.domain === d),
      inherited: rows.find((c) => c.domain === null && c.is_default) ?? null,
    };
  }, [configs.data]);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <header>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Sparkles className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            LLM Providers
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Choose which LLM provider and API key each part of the platform uses.
            A domain without its own provider falls back to the platform default.
            Keys are stored encrypted in Supabase Vault and never returned to the
            browser.
          </p>
        </header>

        {configs.isPending && (
          <div className="space-y-2 rounded-lg border p-4">
            {Array.from({ length: 3 }).map((_, i) => (
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

        {configs.isSuccess && (
          <div className="space-y-4">
            <DomainSection
              domain={null}
              configs={byDomain.platformDefault}
              inheritedFrom={null}
              onAdd={setCreateFor}
              onEdit={setEditing}
            />
            {LLM_DOMAINS.map((d) => (
              <DomainSection
                key={d}
                domain={d}
                configs={byDomain.forDomain(d)}
                inheritedFrom={byDomain.inherited}
                onAdd={setCreateFor}
                onEdit={setEditing}
              />
            ))}
          </div>
        )}

        <ProviderFormSheet
          editing={editing}
          defaultDomain={createFor ?? null}
          open={editing !== null || createFor !== undefined}
          onOpenChange={(open) => {
            if (!open) {
              setEditing(null);
              setCreateFor(undefined);
            }
          }}
        />
      </div>
    </DashboardLayout>
  );
}

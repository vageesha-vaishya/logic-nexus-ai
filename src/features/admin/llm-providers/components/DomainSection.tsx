import { Plus } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/design-system";
import { ProviderCard } from "./ProviderCard";
import { DOMAIN_DESCRIPTIONS, DOMAIN_LABELS } from "../constants";
import type { LlmDomain, LlmProviderConfig } from "../types";

export interface DomainSectionProps {
  /** null renders the tenant-wide default section. */
  domain: LlmDomain | null;
  /** Configs whose domain matches this section. */
  configs: LlmProviderConfig[];
  /** The tenant-wide default, shown when this domain has no config. */
  inheritedFrom: LlmProviderConfig | null;
  onAdd: (domain: LlmDomain | null) => void;
  onEdit: (config: LlmProviderConfig) => void;
}

export function DomainSection({
  domain,
  configs,
  inheritedFrom,
  onAdd,
  onEdit,
}: DomainSectionProps) {
  const title = domain ? DOMAIN_LABELS[domain] : "Platform default";
  const description = domain
    ? DOMAIN_DESCRIPTIONS[domain]
    : "Used by any domain without a provider of its own.";

  // The resolver only ever picks a row that is both active and the default,
  // so that's the only condition under which this section actually has its
  // own effective config. A row that exists but isn't active+default still
  // renders below (nothing disappears from the UI) — it just doesn't change
  // which state line is shown.
  const hasOwnEffectiveConfig = configs.some((cfg) => cfg.is_active && cfg.is_default);

  const emptyStateMessage = domain
    ? "No provider configured. Calls for this domain will fall back to the server's environment configuration."
    : "No platform default configured. Calls will fall back to the server's environment configuration.";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => onAdd(domain)}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Add provider
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {configs.length > 0 &&
          configs.map((cfg) => (
            <ProviderCard key={cfg.id} config={cfg} onEdit={() => onEdit(cfg)} />
          ))}
        {!hasOwnEffectiveConfig &&
          (inheritedFrom ? (
            <p className="text-sm text-muted-foreground">
              Inherits platform default — {inheritedFrom.provider} / {inheritedFrom.default_model}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{emptyStateMessage}</p>
          ))}
      </CardContent>
    </Card>
  );
}

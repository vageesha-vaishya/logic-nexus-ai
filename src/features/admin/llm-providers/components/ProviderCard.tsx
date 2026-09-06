import { toast } from "sonner";
import { CheckCircle2, KeyRound, Trash2 } from "lucide-react";

import { useSaveLlmConfig, useDeleteLlmConfig } from "../hooks/useLlmConfigs";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
} from "@/design-system";
import { PROVIDER_LABELS } from "../constants";
import type { LlmProviderConfig } from "../types";

export function ProviderCard({
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
              const confirmMsg =
                config.domain !== null
                  ? `Remove "${config.display_name}"? This domain will revert to the platform default.`
                  : `Delete "${config.display_name}"? This removes the API key from Vault.`;
              if (!confirm(confirmMsg)) return;
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
            <span className="sr-only">
              {config.domain !== null ? "Remove — revert to platform default" : "Delete"}
            </span>
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

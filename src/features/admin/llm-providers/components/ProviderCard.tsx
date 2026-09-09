import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, KeyRound, Trash2 } from "lucide-react";

import { useSaveLlmConfig, useDeleteLlmConfig } from "../hooks/useLlmConfigs";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Badge,
} from "@/design-system";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isRevert = config.domain !== null;
  const confirmCopy = isRevert
    ? {
        title: "Remove provider?",
        description: `Remove "${config.display_name}"? This domain will revert to the platform default.`,
        action: "Remove",
      }
    : {
        title: "Delete provider?",
        description: `Delete "${config.display_name}"? This removes the API key from Vault.`,
        action: "Delete",
      };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="min-w-0">
          {/* h4, not CardTitle's h3: this card nests inside a DomainSection
              card whose own CardTitle is already an h3 — matching that level
              here would give screen-reader heading navigation two same-level
              headings for what is visually a subsection. */}
          <h4 className="flex items-center gap-2 text-base font-semibold leading-none tracking-tight">
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
          </h4>
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
            onClick={() => setConfirmOpen(true)}
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

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmCopy.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmCopy.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await del.mutateAsync(config.id);
                  toast.success("Provider removed");
                } catch (e: any) {
                  toast.error(e?.message ?? "Failed to delete");
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {confirmCopy.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/**
 * PortfolioActionsMenu — three-dot menu in the mobile portfolio
 * detail header. Slice 4 of the mobile portfolio detail surface
 * (see session analysis 2026-05-26).
 *
 * Actions:
 *   • Import holdings → existing ImportHoldingsDialog
 *   • Refresh values  → useRefreshNav (recomputes NAV server-side)
 *   • Rename          → inline dialog → useUpdatePortfolio
 *   • Delete          → confirm → useDeletePortfolio → navigate back
 *
 * Deliberately excludes Paper-Live mode toggle: switching a
 * tracking portfolio into a real-money one warrants more friction
 * than a dropdown click. Defer until the retail flow has a
 * dedicated migration UX.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Edit3, FileDown, Loader2, MoreVertical, RefreshCw, Trash2,
} from "lucide-react";
import { toast } from "sonner";

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
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, Input, Label,
} from "@/design-system";

import { ImportHoldingsDialog } from "../../components/ImportHoldingsDialog";
import { useRefreshNav } from "../../hooks/usePortfolio";
import { useDeletePortfolio, useUpdatePortfolio } from "../../hooks/usePortfolios";
import type { Portfolio } from "../../types";

export interface PortfolioActionsMenuProps {
  portfolio: Portfolio;
}

export function PortfolioActionsMenu({ portfolio }: PortfolioActionsMenuProps) {
  const navigate = useNavigate();
  const [importOpen, setImportOpen]   = useState(false);
  const [renameOpen, setRenameOpen]   = useState(false);
  const [deleteOpen, setDeleteOpen]   = useState(false);
  const [newName, setNewName]         = useState(portfolio.name);

  const refreshNav    = useRefreshNav();
  const updatePortfolio = useUpdatePortfolio();
  const deletePortfolio = useDeletePortfolio();

  async function handleRefresh() {
    try {
      await refreshNav.mutateAsync(portfolio.id);
      toast.success("NAV recomputed");
    } catch (e: any) {
      toast.error(e?.message ?? "Refresh failed");
    }
  }

  async function handleRename() {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === portfolio.name) {
      setRenameOpen(false);
      return;
    }
    try {
      await updatePortfolio.mutateAsync({ id: portfolio.id, name: trimmed });
      toast.success("Renamed");
      setRenameOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Rename failed");
    }
  }

  async function handleDelete() {
    try {
      await deletePortfolio.mutateAsync(portfolio.id);
      toast.success(`Deleted ${portfolio.name}`);
      navigate("/dashboard/markets/retail/portfolio", { replace: true });
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed");
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            aria-label="Portfolio actions"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => setImportOpen(true)}>
            <FileDown className="mr-2 h-4 w-4" />
            Import holdings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleRefresh} disabled={refreshNav.isPending}>
            {refreshNav.isPending
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh values
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => {
            setNewName(portfolio.name);
            setRenameOpen(true);
          }}>
            <Edit3 className="mr-2 h-4 w-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete portfolio
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Import holdings ────────────────────────────────────────────── */}
      <ImportHoldingsDialog
        portfolioId={portfolio.id}
        portfolioName={portfolio.name}
        open={importOpen}
        onOpenChange={setImportOpen}
      />

      {/* ── Rename ─────────────────────────────────────────────────────── */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename portfolio</DialogTitle>
            <DialogDescription className="text-xs">
              Only visible to you. Holdings, transactions and broker links stay intact.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-input" className="text-xs">New name</Label>
            <Input
              id="rename-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoComplete="off"
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setRenameOpen(false)}
              disabled={updatePortfolio.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={updatePortfolio.isPending || !newName.trim() || newName.trim() === portfolio.name}
            >
              {updatePortfolio.isPending
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
                : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ─────────────────────────────────────────────── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {portfolio.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the portfolio and all of its holdings, positions,
              orders and links from broker connections. Transactions are kept
              (they're audit-trail). This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePortfolio.isPending
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting…</>
                : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

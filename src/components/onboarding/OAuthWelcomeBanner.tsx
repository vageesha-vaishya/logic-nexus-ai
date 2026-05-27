/**
 * OAuthWelcomeBanner — one-time welcome surface for users who just
 * completed an OAuth signup roundtrip.
 *
 * Trigger: auth.users.raw_user_meta_data.oauth_welcome_pending is set
 * by the provision-retail-user edge function on first provisioning.
 * Shape:
 *   { domain_code, org_name, created_at }
 *
 * For B2B (logistics/markets): banner says "your org X is ready" and
 * offers a Rename button that opens an inline dialog. The inline
 * dialog updates public.tenants.name via supabase-js — RLS allows
 * tenant_admin to update their own tenant.
 *
 * For Sthira retail (domain_code='sthira-retail'): banner says
 * "your retail account is ready" with a "Get started" CTA and no
 * rename (retail has no org name to rename).
 *
 * Dismissal: "Looks good" / "Done" calls supabase.auth.updateUser
 * to clear oauth_welcome_pending. The user can dismiss their own
 * metadata without service role.
 *
 * Suppression:
 *   - Native shell (Capacitor.isNativePlatform()) — Sthira APK has its
 *     own onboarding via /sthira/splash; skip to avoid duplicate UX.
 *   - Stale flag (created_at > 30 days ago) — hide silently. Avoids
 *     polluted metadata for users who never explicitly dismissed.
 *
 * Design: docs/plans/2026-05-27-oauth-onboarding-polish-design.md
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";

import { useAuth } from "@/hooks/useAuth";
import { useMemberships } from "@/hooks/useMemberships";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface WelcomePayload {
  domain_code: string;
  org_name:    string | null;
  created_at:  string;
}

const STALE_DAYS = 30;

function parseWelcome(raw: unknown): WelcomePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.domain_code !== "string" || typeof obj.created_at !== "string") {
    return null;
  }
  return {
    domain_code: obj.domain_code,
    org_name:    typeof obj.org_name === "string" ? obj.org_name : null,
    created_at:  obj.created_at,
  };
}

function isStale(createdAt: string): boolean {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return true;
  return Date.now() - created > STALE_DAYS * 24 * 60 * 60 * 1000;
}

function domainLabel(code: string): string {
  if (code === "logistics") return "Logistics CRM";
  if (code === "markets")   return "Markets Advisor";
  if (code === "sthira-retail") return "Sthira";
  return "your workspace";
}

export function OAuthWelcomeBanner() {
  const { user } = useAuth();
  const { activeMembership } = useMemberships();

  const [welcome, setWelcome] = useState<WelcomePayload | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  // Native: suppress unconditionally. Sthira APK uses /sthira/splash
  // for its own first-run UX.
  const isNative = useMemo(() => {
    try { return Capacitor.isNativePlatform(); } catch { return false; }
  }, []);

  // Read the flag whenever the user object changes. user_metadata is
  // included in the in-memory user record; no extra API call needed.
  useEffect(() => {
    if (isNative) { setWelcome(null); return; }
    const parsed = parseWelcome(user?.user_metadata?.oauth_welcome_pending);
    if (!parsed) { setWelcome(null); return; }
    if (isStale(parsed.created_at)) { setWelcome(null); return; }
    setWelcome(parsed);
    setRenameValue(parsed.org_name ?? "");
  }, [user, isNative]);

  const clearFlag = useCallback(async () => {
    setDismissing(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { oauth_welcome_pending: null },
      });
      if (error) throw error;
      setWelcome(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't dismiss banner");
    } finally {
      setDismissing(false);
    }
  }, []);

  const submitRename = useCallback(async () => {
    if (!welcome || !activeMembership) return;
    const trimmed = renameValue.trim();
    if (trimmed.length < 2) {
      toast.error("Organization name must be at least 2 characters");
      return;
    }
    setRenameSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("tenants")
        .update({ name: trimmed })
        .eq("id", activeMembership.tenant_id);
      if (error) throw error;
      toast.success(`Organization renamed to "${trimmed}"`);
      setRenameOpen(false);
      await clearFlag();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't rename organization");
    } finally {
      setRenameSaving(false);
    }
  }, [welcome, activeMembership, renameValue, clearFlag]);

  if (!welcome) return null;

  const isRetail = welcome.domain_code === "sthira-retail";
  const productName = domainLabel(welcome.domain_code);

  return (
    <>
      <div
        role="status"
        className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-4 sm:p-5"
        data-testid="oauth-welcome-banner"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <PartyPopper className="h-5 w-5 shrink-0 text-primary mt-0.5" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-semibold">
                Welcome to {productName}
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                {isRetail ? (
                  <>Your retail account is ready. Start with the welcome tour
                  whenever you're set.</>
                ) : welcome.org_name ? (
                  <>Your organization{" "}
                  <span className="font-medium text-foreground">
                    "{welcome.org_name}"
                  </span>
                  {" "}is ready. Rename it any time.</>
                ) : (
                  <>Your workspace is ready.</>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            {!isRetail && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRenameOpen(true)}
                disabled={dismissing}
              >
                Rename
              </Button>
            )}
            <Button
              size="sm"
              onClick={clearFlag}
              disabled={dismissing}
            >
              {dismissing && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              {isRetail ? "Get started" : "Looks good"}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename organization</DialogTitle>
            <DialogDescription>
              This is how your team and customers will see it across {productName}.
              You can change it again from Settings later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="oauth-welcome-rename">Organization name</Label>
            <Input
              id="oauth-welcome-rename"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Your organization"
              autoFocus
              disabled={renameSaving}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameOpen(false)}
              disabled={renameSaving}
            >
              Cancel
            </Button>
            <Button onClick={submitRename} disabled={renameSaving}>
              {renameSaving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

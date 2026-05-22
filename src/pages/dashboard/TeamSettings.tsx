/**
 * Settings → Team — list members + pending invites for the active tenant
 * and let tenant_admins invite teammates.
 *
 * Wires the useTeamManagement hook to a simple two-section layout:
 *   • Members table (current user_roles for this tenant)
 *   • Pending invites list with revoke + copy-link actions
 *   • "Invite teammate" button opens a dialog that posts to invitations
 *
 * Membership scoping is implicit — the hook reads the active membership
 * from useMemberships(), so switching tenants in the topbar switcher
 * automatically swaps the view.
 *
 * See docs/plans/2026-05-22-unified-platform-onboarding-design.md.
 */
import { useState } from "react";
import { Copy, Loader2, Mail, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useTeamManagement, type TeamInvite } from "@/hooks/useTeamManagement";

const ROLE_OPTIONS = [
  { value: "user",            label: "Member" },
  { value: "franchise_admin", label: "Franchise admin" },
  { value: "tenant_admin",    label: "Owner / tenant admin" },
  { value: "viewer",          label: "Viewer (read-only)" },
] as const;

function roleLabel(role: string): string {
  return ROLE_OPTIONS.find((o) => o.value === role)?.label ?? role.replace(/_/g, " ");
}

function isInviteExpired(invite: TeamInvite): boolean {
  return new Date(invite.expires_at).getTime() <= Date.now();
}

function relativeTime(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  const minutes = Math.round(ms / 60_000);
  if (minutes <= 0) return "now";
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.round(hours / 24);
  return `in ${days}d`;
}

export default function TeamSettings() {
  const {
    activeTenantId,
    members,
    pendingInvites,
    isLoading,
    isMutating,
    create,
    revoke,
    inviteLinkFor,
  } = useTeamManagement();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole]   = useState<typeof ROLE_OPTIONS[number]["value"]>("user");

  if (!activeTenantId && !isLoading) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-3xl py-12 text-center text-sm text-muted-foreground">
          No active tenant. Pick a workspace from the topbar switcher first.
        </div>
      </DashboardLayout>
    );
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      toast.error("Enter the teammate's email first.");
      return;
    }
    try {
      const invite = await create({ email: inviteEmail, role: inviteRole });
      const link = inviteLinkFor(invite);
      await navigator.clipboard.writeText(link).catch(() => {});
      toast.success("Invite created — link copied to your clipboard.");
      setInviteEmail("");
      setInviteRole("user");
      setDialogOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not create invite.";
      toast.error(
        /already.*pending/i.test(msg)
          ? "There's already a pending invite for that email. Revoke it first."
          : msg,
      );
    }
  };

  const handleCopy = async (invite: TeamInvite) => {
    const link = inviteLinkFor(invite);
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Invite link copied.");
    } catch {
      toast.error("Couldn't copy to clipboard — copy it manually: " + link);
    }
  };

  const handleRevoke = async (invite: TeamInvite) => {
    try {
      await revoke(invite.id);
      toast.success("Invite revoked.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not revoke.");
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage members and pending invites for this workspace.
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite teammate
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite a teammate</DialogTitle>
                <DialogDescription>
                  We'll create a magic link you can paste into an email or chat.
                  The link expires in 7 days.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleInvite} className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-email">Work email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    autoComplete="off"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="teammate@company.com"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-role">Role</Label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as typeof inviteRole)}>
                    <SelectTrigger id="invite-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isMutating} className="w-full">
                    {isMutating ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating invite…
                      </span>
                    ) : "Create invite & copy link"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </header>

        {/* Members */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Members
              <Badge variant="secondary" className="ml-1">{members.length}</Badge>
            </CardTitle>
            <CardDescription>People who already have access to this workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading members…
              </div>
            ) : members.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                No members yet — invite someone above.
              </p>
            ) : (
              <ul className="divide-y">
                {members.map((m) => {
                  const name = [m.first_name, m.last_name].filter(Boolean).join(" ").trim();
                  return (
                    <li key={m.user_role_id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {name || m.email}
                          {m.is_self && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                        </p>
                        {name && <p className="truncate text-xs text-muted-foreground">{m.email}</p>}
                      </div>
                      <Badge variant="outline">{roleLabel(m.role)}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Pending invites */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" />
              Pending invites
              <Badge variant="secondary" className="ml-1">{pendingInvites.length}</Badge>
            </CardTitle>
            <CardDescription>
              Magic links that haven't been claimed yet. Expire 7 days after creation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingInvites.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                Nothing waiting — when you invite someone, the link shows up here.
              </p>
            ) : (
              <ul className="divide-y">
                {pendingInvites.map((invite) => {
                  const expired = isInviteExpired(invite);
                  return (
                    <li key={invite.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="truncate text-sm font-medium">{invite.email}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {roleLabel(invite.role)} · expires {relativeTime(invite.expires_at)}
                          {expired && " (expired)"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleCopy(invite)}
                          aria-label="Copy invite link"
                          title="Copy link"
                          disabled={expired}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleRevoke(invite)}
                          aria-label="Revoke invite"
                          title="Revoke"
                          disabled={isMutating}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

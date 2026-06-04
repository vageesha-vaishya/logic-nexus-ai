// ApplicabilityQueueAlertsConfigPage — admin UI for the per-tenant
// queue-depth notification config shipped in Directive Applicability
// S8 (migration 20260604060000).

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Loader2,
  AlertTriangle,
  Save,
  Bell,
} from 'lucide-react';
import { toast } from 'sonner';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group';

import { useCRM } from '@/hooks/useCRM';
import {
  useApplicabilityQueueAlertConfig,
  useConfigureApplicabilityQueueAlerts,
  useAuthRoles,
} from '../hooks/useApplicabilityQueueAlertConfig';

type RecipientKind = 'role' | 'user' | 'team';

export default function ApplicabilityQueueAlertsConfigPage() {
  const { context } = useCRM();
  const tenantId = context?.tenantId ?? null;

  const configQuery = useApplicabilityQueueAlertConfig();
  const configMutation = useConfigureApplicabilityQueueAlerts();
  const rolesQuery = useAuthRoles();

  // Form state
  const [enabled, setEnabled] = useState(false);
  const [threshold, setThreshold] = useState(20);
  const [recipientKind, setRecipientKind] = useState<RecipientKind>('role');
  const [recipientRoleId, setRecipientRoleId] = useState<string>('');
  const [recipientUserId, setRecipientUserId] = useState('');
  const [recipientTeamId, setRecipientTeamId] = useState('');
  const [notes, setNotes] = useState('');

  // Hydrate form from server state once
  useEffect(() => {
    const cfg = configQuery.data;
    if (!cfg) return;
    setEnabled(cfg.enabled);
    setThreshold(cfg.threshold);
    setNotes(cfg.notes ?? '');
    if (cfg.recipient_role_id) {
      setRecipientKind('role');
      setRecipientRoleId(cfg.recipient_role_id);
    } else if (cfg.recipient_user_id) {
      setRecipientKind('user');
      setRecipientUserId(cfg.recipient_user_id);
    } else if (cfg.recipient_team_id) {
      setRecipientKind('team');
      setRecipientTeamId(cfg.recipient_team_id);
    }
  }, [configQuery.data]);

  const handleSave = async () => {
    if (!tenantId) {
      toast.error('Tenant context not loaded');
      return;
    }
    if (enabled) {
      if (recipientKind === 'role' && !recipientRoleId) {
        toast.error('Pick a role when enabling alerts');
        return;
      }
      if (recipientKind === 'user' && !recipientUserId.trim()) {
        toast.error('Enter a user ID when enabling alerts');
        return;
      }
      if (recipientKind === 'team' && !recipientTeamId.trim()) {
        toast.error('Enter a team ID when enabling alerts');
        return;
      }
      if (!Number.isInteger(threshold) || threshold < 1) {
        toast.error('Threshold must be a positive integer');
        return;
      }
    }

    await configMutation.mutateAsync({
      tenant_id: tenantId,
      enabled,
      threshold,
      recipient_role_id: enabled && recipientKind === 'role' ? recipientRoleId : null,
      recipient_user_id: enabled && recipientKind === 'user' ? recipientUserId.trim() : null,
      recipient_team_id: enabled && recipientKind === 'team' ? recipientTeamId.trim() : null,
      notes: notes.trim() || null,
    });
  };

  const roles = rolesQuery.data ?? [];
  const cfg = configQuery.data;

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Bell className="h-6 w-6 text-primary" />
              Applicability Queue Alerts
            </h1>
            <p className="text-sm text-muted-foreground">
              Get notified when the review queue depth crosses a threshold.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/dashboard/amro/directives/applicability/queue">
              <ShieldCheck className="mr-2 h-4 w-4" />
              Open review queue
            </Link>
          </Button>
        </div>

        {/* Status card */}
        {configQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading config…
          </div>
        ) : !cfg ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4" />
              Not configured yet
            </div>
            <p className="mt-1 text-xs text-amber-900 dark:text-amber-200">
              Configure recipients + threshold below to start receiving notifications.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-3 text-sm">
            <Badge variant={cfg.enabled ? 'default' : 'secondary'}>
              {cfg.enabled ? 'Active' : 'Disabled'}
            </Badge>
            {cfg.enabled && (
              <>
                <span>Threshold: <span className="font-mono">{cfg.threshold}</span></span>
                <span>
                  Recipient:{' '}
                  {cfg.recipient_role_id ? `Role ${cfg.recipient_role_id.slice(0, 8)}` :
                   cfg.recipient_user_id ? `User ${cfg.recipient_user_id.slice(0, 8)}` :
                   cfg.recipient_team_id ? `Team ${cfg.recipient_team_id.slice(0, 8)}` :
                   '—'}
                </span>
              </>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              Updated {new Date(cfg.updated_at).toLocaleDateString()}
            </span>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuration</CardTitle>
            <CardDescription>
              Notifications fire when the awaiting-review queue depth equals the threshold (one-shot — re-fires only after the queue drops back below).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Enable toggle */}
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="enabled" className="text-sm font-medium">
                  Enable queue depth alerts
                </Label>
                <p className="text-xs text-muted-foreground">
                  When off, the trigger is a no-op for this tenant.
                </p>
              </div>
              <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} />
            </div>

            {/* Threshold */}
            <div className="space-y-1.5">
              <Label htmlFor="threshold">Threshold</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="threshold"
                  type="number"
                  min={1}
                  value={threshold}
                  onChange={(e) => setThreshold(parseInt(e.target.value, 10) || 0)}
                  disabled={!enabled}
                  className="w-32 font-mono"
                />
                <span className="text-xs text-muted-foreground">verdicts awaiting review</span>
              </div>
            </div>

            <Separator />

            {/* Recipient picker */}
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Recipient</Label>
                <p className="text-xs text-muted-foreground">
                  Required when alerts are enabled. Exactly one of role/user/team.
                </p>
              </div>
              <RadioGroup
                value={recipientKind}
                onValueChange={(v) => setRecipientKind(v as RecipientKind)}
                disabled={!enabled}
                className="grid grid-cols-3 gap-2"
              >
                <Label className={`flex cursor-pointer items-center gap-2 rounded-md border p-3 ${recipientKind === 'role' ? 'border-primary bg-primary/5' : ''} ${!enabled ? 'opacity-50' : ''}`}>
                  <RadioGroupItem value="role" />
                  Role (most common)
                </Label>
                <Label className={`flex cursor-pointer items-center gap-2 rounded-md border p-3 ${recipientKind === 'user' ? 'border-primary bg-primary/5' : ''} ${!enabled ? 'opacity-50' : ''}`}>
                  <RadioGroupItem value="user" />
                  Specific user
                </Label>
                <Label className={`flex cursor-pointer items-center gap-2 rounded-md border p-3 ${recipientKind === 'team' ? 'border-primary bg-primary/5' : ''} ${!enabled ? 'opacity-50' : ''}`}>
                  <RadioGroupItem value="team" />
                  Team
                </Label>
              </RadioGroup>

              {recipientKind === 'role' && (
                <div className="space-y-1.5">
                  <Label htmlFor="role-id" className="text-xs">Role</Label>
                  <Select
                    value={recipientRoleId}
                    onValueChange={setRecipientRoleId}
                    disabled={!enabled}
                  >
                    <SelectTrigger id="role-id">
                      <SelectValue placeholder="Pick a role…" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.length === 0 && (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                          {rolesQuery.isLoading ? 'Loading roles…' : 'No roles available'}
                        </div>
                      )}
                      {roles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {recipientKind === 'user' && (
                <div className="space-y-1.5">
                  <Label htmlFor="user-id" className="text-xs">User ID (UUID)</Label>
                  <Input
                    id="user-id"
                    value={recipientUserId}
                    onChange={(e) => setRecipientUserId(e.target.value)}
                    placeholder="00000000-0000-0000-0000-000000000000"
                    disabled={!enabled}
                    className="font-mono text-xs"
                  />
                </div>
              )}

              {recipientKind === 'team' && (
                <div className="space-y-1.5">
                  <Label htmlFor="team-id" className="text-xs">Team ID (UUID)</Label>
                  <Input
                    id="team-id"
                    value={recipientTeamId}
                    onChange={(e) => setRecipientTeamId(e.target.value)}
                    placeholder="00000000-0000-0000-0000-000000000000"
                    disabled={!enabled}
                    className="font-mono text-xs"
                  />
                </div>
              )}
            </div>

            <Separator />

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. 'Routed to Director of Maintenance group via amro_managers role.'"
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => void handleSave()}
                disabled={configMutation.isPending || !tenantId}
              >
                {configMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
                ) : (
                  <><Save className="mr-2 h-4 w-4" />Save</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

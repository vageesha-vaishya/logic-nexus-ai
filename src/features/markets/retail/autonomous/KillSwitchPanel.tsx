// src/features/markets/retail/autonomous/KillSwitchPanel.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useKillSwitch, useSetKillSwitch } from './hooks/useKillSwitch';
import type { KillSwitchLevel } from './types';

const KILL_SWITCH_ACTIONS: {
  level: KillSwitchLevel;
  label: string;
  description: string;
  variant: 'default' | 'outline' | 'destructive';
}[] = [
  { level: 'strategy_pause',    label: 'Pause Strategy',      description: 'Pause a specific rule',        variant: 'outline' },
  { level: 'all_pause',         label: 'Pause All',           description: 'Stop all auto-execution',      variant: 'default' },
  { level: 'flatten_positions', label: 'Flatten Positions',   description: 'Cancel open orders now',       variant: 'destructive' },
  { level: 'revoke_api_key',    label: 'Revoke API Key',      description: 'Disable broker connection',    variant: 'destructive' },
];

export function KillSwitchPanel() {
  const { data: state } = useKillSwitch();
  const { mutate: setKillSwitch, isPending } = useSetKillSwitch();

  const active = state?.kill_switch_level ?? 'none';

  return (
    <Card className="border-destructive/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-destructive">Kill Switch</CardTitle>
          {active !== 'none' && (
            <Badge variant="destructive" className="text-xs">
              {active.replace(/_/g, ' ')}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {KILL_SWITCH_ACTIONS.map(({ level, label, description, variant }) => (
          <div key={level} className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <Button
              size="sm"
              variant={active === level ? 'secondary' : variant}
              disabled={isPending}
              onClick={() => setKillSwitch(active === level ? 'none' : level)}
              className="text-xs h-7 px-3"
            >
              {active === level ? 'Active — Reset' : label}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

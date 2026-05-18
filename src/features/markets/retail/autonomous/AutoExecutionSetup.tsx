// src/features/markets/retail/autonomous/AutoExecutionSetup.tsx
import { useExecutionRules } from './hooks/useExecutionRules';
import { RuleBuilder } from './RuleBuilder';
import { GradualAutonomyWizard } from './GradualAutonomyWizard';
import { KillSwitchPanel } from './KillSwitchPanel';
import { Badge } from '@/components/ui/badge';

export function AutoExecutionSetup() {
  const { data: rules = [], isLoading } = useExecutionRules();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Auto-Execution</h3>
        <Badge variant="outline" className="text-xs">{rules.length} rules</Badge>
      </div>

      <GradualAutonomyWizard />
      <RuleBuilder />
      <KillSwitchPanel />

      {!isLoading && rules.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Active Rules</p>
          {rules.map(rule => (
            <div key={rule.id} className="rounded-lg border p-3 text-xs space-y-0.5">
              <p className="font-medium">{rule.name}</p>
              <p className="text-muted-foreground capitalize">
                {rule.asset_class.replace(/_/g, ' ')} · {rule.signal_type} · {rule.order_type}
              </p>
              <p className="text-muted-foreground">
                Max ₹{rule.max_order_value.toLocaleString('en-IN')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

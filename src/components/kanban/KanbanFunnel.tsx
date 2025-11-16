import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type StringRecord<T extends string> = Record<T, string>;

interface KanbanFunnelProps<TStage extends string> {
  title?: string;
  stages: TStage[];
  labels: StringRecord<TStage>;
  colors: StringRecord<TStage>;
  counts: Record<TStage, number>;
  total?: number;
  valueMetricLabel?: string;
  valueMetric?: string | number | null;
  activeStage?: TStage | null;
  activeStages?: TStage[];
  onStageClick?: (stage: TStage) => void;
  onClearStage?: () => void;
}

export function KanbanFunnel<TStage extends string>(props: KanbanFunnelProps<TStage>) {
  const { title = "Pipeline Funnel", stages, labels, colors, counts, total, valueMetricLabel, valueMetric, activeStage, activeStages, onStageClick, onClearStage } = props;

  const sum = typeof total === "number" ? total : stages.reduce((acc, s) => acc + (counts[s] || 0), 0);
  const safeSum = sum > 0 ? sum : 1; // avoid division by zero

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <span className="text-xs text-muted-foreground">Total: {sum}</span>
        </div>
        <div className="flex items-center gap-2">
          {valueMetricLabel && valueMetric !== undefined && valueMetric !== null && (
            <div className="text-xs font-semibold text-primary">
              {valueMetricLabel}: {valueMetric}
            </div>
          )}
          {(activeStage || (activeStages && activeStages.length > 0)) && onClearStage && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClearStage}>
              Clear filter
            </Button>
          )}
        </div>
      </div>

      <div className="w-full rounded-md bg-muted h-2 overflow-hidden">
        <div className="flex h-2">
          {stages.map((stage) => {
            const widthPct = Math.round(((counts[stage] || 0) / safeSum) * 100);
            const style = { width: `${widthPct}%` } as const;
            const colorClass = colors[stage];
            const isActive = activeStage === stage || (activeStages?.includes(stage) ?? false);
            return (
              <button
                key={stage}
                type="button"
                style={style}
                className={`${colorClass} h-2 focus:outline-none ${onStageClick ? 'cursor-pointer' : ''} ${isActive ? 'ring-2 ring-offset-1 ring-primary' : ''}`}
                aria-label={`Filter by ${labels[stage]}`}
                onClick={onStageClick ? () => onStageClick(stage) : undefined}
              />
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {stages.map((stage) => {
          const isActive = activeStage === stage || (activeStages?.includes(stage) ?? false);
          return (
            <Badge
              key={stage}
              variant="secondary"
              className={`${colors[stage]} ${onStageClick ? 'cursor-pointer' : ''} ${isActive ? 'ring-2 ring-primary' : ''}`}
              onClick={onStageClick ? () => onStageClick(stage) : undefined}
            >
              {labels[stage]}: {counts[stage] || 0}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type StringRecord<T extends string> = Record<T, string>;

interface KanbanFunnelProps<TStage extends string> {
  title?: string;
  stages: TStage[];
  labels: StringRecord<TStage>;
  colors: StringRecord<TStage>;
  indicatorColors?: StringRecord<TStage>;
  counts: Record<TStage, number>;
  total?: number;
  valueMetricLabel?: string;
  valueMetric?: string | number | null;
  activeStage?: TStage | null;
  activeStages?: TStage[];
  layout?: "default" | "single-line";
  onStageClick?: (stage: TStage) => void;
  onClearStage?: () => void;
}

export function KanbanFunnel<TStage extends string>(props: KanbanFunnelProps<TStage>) {
  const { title = "Pipeline Funnel", stages, labels, colors, indicatorColors, counts, total, valueMetricLabel, valueMetric, activeStage, activeStages, layout = "default", onStageClick, onClearStage } = props;

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

      {layout === "single-line" ? (
        <div className="overflow-x-auto pb-1" data-testid="kanban-funnel-rail">
          <TooltipProvider>
            <div className="flex min-w-max items-center">
              {stages.map((stage, index) => {
                const count = counts[stage] || 0;
                const widthPct = Math.round((count / safeSum) * 100);
                const isActive = activeStage === stage || (activeStages?.includes(stage) ?? false);
                return (
                  <div key={stage} className="flex items-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          data-testid={`kanban-funnel-stage-${stage}`}
                          data-stage={stage}
                          className={cn(
                            "flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm transition-all",
                            onStageClick ? "cursor-pointer hover:border-primary/60 hover:shadow-sm" : "",
                            isActive ? "border-primary ring-2 ring-primary/30" : "border-border"
                          )}
                          aria-label={`Filter by ${labels[stage]}`}
                          onClick={onStageClick ? () => onStageClick(stage) : undefined}
                        >
                          <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", indicatorColors?.[stage] || "bg-primary")} />
                          <span className="whitespace-nowrap text-foreground">{labels[stage]}</span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                              isActive ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                            )}
                          >
                            {count}
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium">{labels[stage]}</p>
                          <p className="text-xs text-muted-foreground">{count} leads</p>
                          <p className="text-xs text-muted-foreground">{widthPct}% of total pipeline</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                    {index < stages.length - 1 && (
                      <div className="mx-2 h-px w-6 shrink-0 bg-border sm:w-10" data-testid="kanban-funnel-connector" />
                    )}
                  </div>
                );
              })}
            </div>
          </TooltipProvider>
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}

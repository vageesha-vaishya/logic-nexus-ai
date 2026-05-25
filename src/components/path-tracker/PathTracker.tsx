import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type PathTrackerField = {
  label: string;
  value: React.ReactNode;
};

export type PathTrackerStage = {
  id: string;
  label: string;
  fields?: PathTrackerField[];
  guidance?: React.ReactNode;
};

export interface PathTrackerProps {
  stages: PathTrackerStage[];
  currentStageId: string;
  completedStageIds?: string[];
  onStageClick?: (stageId: string) => void;
  className?: string;
}

type StageState = "completed" | "current" | "upcoming";

function stageState(
  stageId: string,
  currentStageId: string,
  completedSet: Set<string>,
): StageState {
  if (stageId === currentStageId) return "current";
  if (completedSet.has(stageId)) return "completed";
  return "upcoming";
}

const chipBase =
  "relative inline-flex items-center justify-center h-9 px-4 text-xs font-medium select-none transition-colors";
// Chevron via clip-path: pointed right, flat left except first stage handled by container rounding.
const chipChevron =
  "[clip-path:polygon(0_0,calc(100%-12px)_0,100%_50%,calc(100%-12px)_100%,0_100%,12px_50%)]";
const chipFirst =
  "[clip-path:polygon(0_0,calc(100%-12px)_0,100%_50%,calc(100%-12px)_100%,0_100%)]";
const chipLast =
  "[clip-path:polygon(0_0,100%_0,100%_100%,0_100%,12px_50%)]";

export function PathTracker({
  stages,
  currentStageId,
  completedStageIds,
  onStageClick,
  className,
}: PathTrackerProps): JSX.Element {
  const completedSet = new Set(completedStageIds ?? []);
  const current = stages.find((s) => s.id === currentStageId);
  const interactive = Boolean(onStageClick);

  return (
    <div className={cn("w-full", className)} data-testid="path-tracker">
      <ol
        className="flex w-full overflow-x-auto"
        role="list"
        aria-label="Stage progression"
      >
        {stages.map((stage, idx) => {
          const state = stageState(stage.id, currentStageId, completedSet);
          const isFirst = idx === 0;
          const isLast = idx === stages.length - 1;

          const tone =
            state === "current"
              ? "bg-primary text-primary-foreground"
              : state === "completed"
                ? "bg-primary/15 text-primary"
                : "bg-muted text-muted-foreground";

          const Cmp = interactive ? "button" : "div";

          return (
            <li
              key={stage.id}
              className={cn("flex-1 min-w-[140px]", idx > 0 && "-ml-2")}
              aria-current={state === "current" ? "step" : undefined}
            >
              <Cmp
                type={interactive ? "button" : undefined}
                onClick={interactive ? () => onStageClick?.(stage.id) : undefined}
                className={cn(
                  "w-full",
                  chipBase,
                  isFirst ? chipFirst : isLast ? chipLast : chipChevron,
                  tone,
                  interactive &&
                    "cursor-pointer hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                )}
                aria-label={`Stage ${idx + 1} of ${stages.length}: ${stage.label} (${state})`}
              >
                {state === "completed" && (
                  <Check className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                )}
                <span className="truncate">{stage.label}</span>
              </Cmp>
            </li>
          );
        })}
      </ol>

      {current && (current.fields?.length || current.guidance) && (
        <div
          className="mt-4 rounded-md border bg-card p-4"
          data-testid="path-tracker-key-fields"
        >
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Key fields for {current.label}
          </p>
          {current.fields && current.fields.length > 0 && (
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {current.fields.map((field) => (
                <div key={field.label} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{field.label}</dt>
                  <dd className="text-sm font-medium truncate">{field.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {current.guidance && (
            <div className="mt-3 text-xs text-muted-foreground">
              {current.guidance}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

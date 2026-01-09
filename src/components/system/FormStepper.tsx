import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A single step descriptor for FormStepper.
 * @property id Unique identifier for the step
 * @property label Display label shown in the stepper
 */
interface Step {
  id: string;
  label: string;
}

/**
 * Props for FormStepper, a compact step navigation bar
 * with Back/Next actions and optional right-side content.
 * @property steps Ordered list of steps to display
 * @property activeId Currently active step id
 * @property onPrev Optional handler for Back button
 * @property onNext Optional handler for Next button
 * @property className Optional container className
 * @property right Optional content injected before actions
 */
interface FormStepperProps {
  /**
   * Array of steps to display.
   */
  steps: Step[];
  /**
   * The ID of the currently active step.
   */
  activeId: string;
  /**
   * Callback for the Back button.
   */
  onPrev?: () => void;
  /**
   * Callback for the Next button.
   */
  onNext?: () => void;
  /**
   * Optional CSS class names.
   */
  className?: string;
  /**
   * Optional element to render on the right side of the stepper.
   */
  right?: ReactNode;
}

export function FormStepper({ steps, activeId, onPrev, onNext, className, right }: FormStepperProps) {
  return (
    <div className={cn("flex items-center justify-between border rounded-md p-2 bg-muted/30", className)}>
      <div className="flex items-center gap-2">
        {steps.map((s) => (
          <div
            key={s.id}
            className={cn(
              "px-3 py-1 rounded-md text-sm",
              s.id === activeId ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
            aria-current={s.id === activeId ? "step" : undefined}
          >
            {s.label}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        {right}
        {onPrev && (
          <Button variant="outline" onClick={onPrev}>
            Back
          </Button>
        )}
        {onNext && (
          <Button onClick={onNext}>
            Next
          </Button>
        )}
      </div>
    </div>
  );
}

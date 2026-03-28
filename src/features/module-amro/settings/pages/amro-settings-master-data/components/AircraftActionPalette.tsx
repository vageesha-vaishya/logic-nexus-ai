import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export type AircraftPaletteActionGroup = 'primary' | 'secondary' | 'contextual';

export type AircraftPaletteAction = {
  id: string;
  label: string;
  icon?: ReactNode;
  group: AircraftPaletteActionGroup;
  onAction: () => void | Promise<void>;
  permission?: string;
  hideWhenUnauthorized?: boolean;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  ariaLabel?: string;
  successMessage?: string;
  errorMessage?: string;
};

export type AircraftActionPermissionResolver = (permission: string) => boolean;

export function isPaletteActionAuthorized(action: AircraftPaletteAction, hasPermission: AircraftActionPermissionResolver): boolean {
  if (!action.permission) {
    return true;
  }
  return hasPermission(action.permission);
}

export function buildPaletteActionGroups(
  actions: AircraftPaletteAction[],
  hasPermission: AircraftActionPermissionResolver,
): Record<AircraftPaletteActionGroup, AircraftPaletteAction[]> {
  const grouped: Record<AircraftPaletteActionGroup, AircraftPaletteAction[]> = {
    primary: [],
    secondary: [],
    contextual: [],
  };
  actions.forEach((action) => {
    const authorized = isPaletteActionAuthorized(action, hasPermission);
    if (!authorized && action.hideWhenUnauthorized) {
      return;
    }
    grouped[action.group].push(action);
  });
  return grouped;
}

type AircraftActionPaletteProps = {
  actions: AircraftPaletteAction[];
  hasPermission?: AircraftActionPermissionResolver;
  className?: string;
  buttonClassName?: string;
  compact?: boolean;
};

export function AircraftActionPalette({
  actions,
  hasPermission = () => true,
  className,
  buttonClassName,
  compact = false,
}: AircraftActionPaletteProps) {
  const [activeActionId, setActiveActionId] = useState('');

  const groupedActions = useMemo(() => buildPaletteActionGroups(actions, hasPermission), [actions, hasPermission]);

  const orderedActions = useMemo(
    () => [...groupedActions.primary, ...groupedActions.secondary, ...groupedActions.contextual],
    [groupedActions],
  );

  const handleAction = async (action: AircraftPaletteAction) => {
    const authorized = isPaletteActionAuthorized(action, hasPermission);
    if (!authorized) {
      toast.error('You do not have permission to perform this action');
      return;
    }
    setActiveActionId(action.id);
    try {
      await action.onAction();
      if (action.successMessage) {
        toast.success(action.successMessage);
      }
    } catch (error) {
      toast.error(action.errorMessage || String((error as Error).message || 'Action failed'));
    } finally {
      setActiveActionId('');
    }
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-2', compact && 'gap-1.5', className)}>
      {orderedActions.map((action) => {
        const authorized = isPaletteActionAuthorized(action, hasPermission);
        const isBusy = activeActionId === action.id || action.loading;
        return (
          <Button
            key={action.id}
            type="button"
            size={compact ? 'sm' : 'default'}
            variant={action.variant || (action.group === 'primary' ? 'default' : action.group === 'secondary' ? 'outline' : 'secondary')}
            className={buttonClassName}
            onClick={() => {
              void handleAction(action);
            }}
            disabled={action.disabled || !authorized || isBusy}
            aria-label={action.ariaLabel || action.label}
          >
            {isBusy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : action.icon}
            <span>{action.label}</span>
          </Button>
        );
      })}
    </div>
  );
}

export default AircraftActionPalette;

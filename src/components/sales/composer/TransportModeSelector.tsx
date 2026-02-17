import { Card } from '@/components/ui/card';
import { useTransportModes } from '@/hooks/useTransportModes';
import { useCarriersByMode } from '@/hooks/useCarriersByMode';
import { normalizeModeCode } from '@/lib/mode-utils';
import {
  Loader2,
  Ship,
  Plane,
  Truck,
  Train,
  Package,
  Waves,
  Container,
  Navigation,
  Anchor,
  Bus,
  Network,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface TransportMode {
  id: string;
  code: string;
  name: string;
  icon_name: string;
  color: string;
}

interface TransportModeSelectorProps {
  selectedMode: string | null;
  onSelect: (modeId: string) => void;
}

const ICON_MAP: Record<string, any> = {
  Ship, 
  Plane, 
  Truck, 
  Train, 
  Package, 
  Waves, 
  Container, 
  Navigation, 
  Anchor, 
  Bus, 
  Network
};

export function TransportModeSelector({ selectedMode, onSelect }: TransportModeSelectorProps) {
  const { modes, loading: modesLoading } = useTransportModes();
  const { carrierMap, isLoading: carriersLoading } = useCarriersByMode();

  const isLoading = modesLoading || carriersLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!modes || modes.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        No transport modes available. Please configure transport modes first.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {modes.map((mode) => {
        const IconComponent = ICON_MAP[mode.icon_name] || Package;
        const isSelected = selectedMode === mode.id;
        const normalizedCode = normalizeModeCode(mode.code);
        const carrierCount = carrierMap[normalizedCode]?.length ?? 0;
        const hasCarriers = carrierCount > 0;

        const content = (
          <div className="p-6 flex flex-col items-center gap-2">
            <div
              className="p-3 rounded-full text-white"
              style={{ backgroundColor: mode.color || '#0f172a' }}
            >
              <IconComponent className="h-6 w-6" />
            </div>
            <span className="font-medium text-sm text-center">{mode.name}</span>
            <span className="text-xs text-muted-foreground">
              {carrierCount} {carrierCount === 1 ? 'carrier' : 'carriers'}
            </span>
          </div>
        );

        if (!hasCarriers) {
          return (
            <TooltipProvider key={mode.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card
                    className="cursor-not-allowed opacity-60"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    {content}
                  </Card>
                </TooltipTrigger>
                <TooltipContent>
                  No carriers configured for this mode.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }

        return (
          <Card
            key={mode.id}
            className={`cursor-pointer transition-all hover:scale-105 ${
              isSelected ? 'ring-2 ring-primary shadow-lg' : ''
            }`}
            onClick={() => onSelect(mode.id)}
          >
            {content}
          </Card>
        );
      })}
    </div>
  );
}

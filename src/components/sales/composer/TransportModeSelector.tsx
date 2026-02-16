import { Card } from '@/components/ui/card';
import { useTransportModes } from '@/hooks/useTransportModes';
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
  Network 
} from 'lucide-react';

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
  const { data: modes, isLoading } = useTransportModes();

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
      {modes.map(mode => {
        // Get the icon from the map, fallback to Package
        const IconComponent = ICON_MAP[mode.icon_name] || Package;
        const isSelected = selectedMode === mode.id;
        
        return (
          <Card
            key={mode.id}
            className={`cursor-pointer transition-all hover:scale-105 ${
              isSelected ? 'ring-2 ring-primary shadow-lg' : ''
            }`}
            onClick={() => onSelect(mode.id)}
          >
            <div className="p-6 flex flex-col items-center gap-3">
              <div 
                className="p-3 rounded-full text-white"
                style={{ backgroundColor: mode.color }}
              >
                <IconComponent className="h-6 w-6" />
              </div>
              <span className="font-medium text-sm text-center">{mode.name}</span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

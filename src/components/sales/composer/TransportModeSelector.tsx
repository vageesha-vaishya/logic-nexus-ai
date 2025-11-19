import * as LucideIcons from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useTransportModes } from '@/hooks/useTransportModes';
import { Loader2 } from 'lucide-react';

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
        // Dynamically get the icon from lucide-react
        const IconComponent = (LucideIcons as any)[mode.icon_name] || LucideIcons.Package;
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

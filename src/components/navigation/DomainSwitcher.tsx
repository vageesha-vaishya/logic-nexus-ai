import React from 'react';
import { useDomain } from '@/contexts/DomainContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Layers } from 'lucide-react';

export function DomainSwitcher() {
  const { currentDomain, setDomain, availableDomains, isLoading } = useDomain();

  if (isLoading) {
    return <div className="h-9 w-[200px] animate-pulse rounded-md bg-muted" />;
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={currentDomain?.code}
        onValueChange={(value) => setDomain(value)}
      >
        <SelectTrigger className="w-[200px] h-9 bg-background border-input">
          <div className="flex items-center gap-2 truncate">
            <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
            <SelectValue placeholder="Select Domain" />
          </div>
        </SelectTrigger>
        <SelectContent>
          {availableDomains.map((domain) => (
            <SelectItem key={domain.id} value={domain.code} textValue={domain.name}>
              <div className="flex flex-col items-start text-left">
                <span className="font-medium leading-none mb-0.5">{domain.name}</span>
                {domain.description && (
                  <span className="text-xs text-muted-foreground line-clamp-1 opacity-70">
                    {domain.description}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

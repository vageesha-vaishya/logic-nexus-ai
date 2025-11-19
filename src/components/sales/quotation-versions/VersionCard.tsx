import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, Trash2, Plus, CheckCircle } from 'lucide-react';
import { VersionStatusSelector } from '../VersionStatusSelector';
import { OptionCard } from './OptionCard';

interface Option {
  id: string;
  quotation_version_id: string;
  option_name?: string | null;
  carrier_name: string;
  total_amount: number;
  currency: string;
  transit_time_days: number | null;
  total_buy?: number;
  total_sell?: number;
  margin_amount?: number;
  margin_percentage?: number;
}

interface Version {
  id: string;
  quote_id: string;
  version_number: number;
  kind: 'minor' | 'major';
  status: string | null;
  created_at: string;
  is_current?: boolean;
}

interface VersionCardProps {
  version: Version;
  options: Option[];
  quoteId: string;
  onCreateOption: (versionId: string) => void;
  onEditOption: (versionId: string, optionId: string) => void;
  onSelectOption: (versionId: string, optionId: string) => void;
  onDeleteVersion: (versionId: string) => void;
  onSetCurrent: (versionId: string) => void;
  onStatusChange: () => void;
  loading: boolean;
}

export function VersionCard({
  version,
  options,
  quoteId,
  onCreateOption,
  onEditOption,
  onSelectOption,
  onDeleteVersion,
  onSetCurrent,
  onStatusChange,
  loading,
}: VersionCardProps) {
  const formattedDate = new Date(version.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        {/* Version Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-lg">
                  Version {version.version_number}
                </h3>
                <Badge variant={version.kind === 'major' ? 'default' : 'secondary'}>
                  {version.kind}
                </Badge>
                {version.is_current && (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Current
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-3 h-3" />
                {formattedDate}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <VersionStatusSelector
              versionId={version.id}
              currentStatus={(version.status as any) || 'draft'}
              onStatusChange={onStatusChange}
            />
            {!version.is_current && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSetCurrent(version.id)}
                disabled={loading}
              >
                Set as Current
              </Button>
            )}
          </div>
        </div>

        {/* Options Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-muted-foreground">
              Options ({options.length})
            </h4>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onCreateOption(version.id)}
              disabled={loading}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Option
            </Button>
          </div>

          {options.length > 0 ? (
            <div className="grid gap-3">
              {options.map((option) => (
                <OptionCard
                  key={option.id}
                  option={option}
                  versionId={version.id}
                  onEdit={onEditOption}
                  onSelect={onSelectOption}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-muted/30 rounded-lg border-2 border-dashed">
              <p className="text-sm text-muted-foreground mb-2">
                No options created yet
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onCreateOption(version.id)}
                disabled={loading}
              >
                <Plus className="w-4 h-4 mr-1" />
                Create First Option
              </Button>
            </div>
          )}
        </div>

        {/* Delete Action */}
        <div className="flex justify-end mt-4 pt-4 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDeleteVersion(version.id)}
            disabled={loading}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Delete Version
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

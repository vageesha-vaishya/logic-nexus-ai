import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Edit2, Check, TrendingUp, DollarSign, Clock } from 'lucide-react';

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

interface OptionCardProps {
  option: Option;
  versionId: string;
  onEdit: (versionId: string, optionId: string) => void;
  onSelect: (versionId: string, optionId: string) => void;
}

export function OptionCard({ option, versionId, onEdit, onSelect }: OptionCardProps) {
  const hasMarginData = option.total_buy !== undefined && option.total_sell !== undefined;

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Option Details */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-medium">
                {option.option_name || option.carrier_name}
              </Badge>
              {option.transit_time_days !== null && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {option.transit_time_days} days
                </span>
              )}
            </div>

            {/* Pricing Information */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <DollarSign className="w-3 h-3" />
                  Total Amount
                </div>
                <div className="font-semibold">
                  {option.currency} {Number(option.total_amount).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>

              {hasMarginData && (
                <>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Buy Cost</div>
                    <div className="font-medium text-muted-foreground">
                      {option.currency} {Number(option.total_buy).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Sell Price</div>
                    <div className="font-medium text-success">
                      {option.currency} {Number(option.total_sell).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <TrendingUp className="w-3 h-3" />
                      Margin
                    </div>
                    <div className="font-semibold text-primary">
                      {option.currency} {Number(option.margin_amount).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                      <span className="text-xs ml-1">
                        ({Number(option.margin_percentage).toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEdit(versionId, option.id)}
              className="whitespace-nowrap"
            >
              <Edit2 className="w-3 h-3 mr-1" />
              Edit
            </Button>
            <Button
              size="sm"
              onClick={() => onSelect(versionId, option.id)}
              className="whitespace-nowrap"
            >
              <Check className="w-3 h-3 mr-1" />
              Select
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowRight, TrendingUp, Clock } from 'lucide-react';

interface Version {
  id: string;
  version_number: number;
  kind: string;
  status: string | null;
  created_at: string;
}

interface Option {
  id: string;
  option_name: string | null;
  carrier_name: string;
  total_amount: number;
  currency: string;
  total_buy?: number;
  total_sell?: number;
  margin_amount?: number;
  margin_percentage?: number;
  transit_time_days: number | null;
}

interface VersionComparisonProps {
  open: boolean;
  onClose: () => void;
  version1Id: string;
  version2Id: string;
}

export function VersionComparison({ open, onClose, version1Id, version2Id }: VersionComparisonProps) {
  const [loading, setLoading] = useState(false);
  const [version1, setVersion1] = useState<Version | null>(null);
  const [version2, setVersion2] = useState<Version | null>(null);
  const [options1, setOptions1] = useState<Option[]>([]);
  const [options2, setOptions2] = useState<Option[]>([]);

  useEffect(() => {
    if (open && version1Id && version2Id) {
      loadVersionData();
    }
  }, [open, version1Id, version2Id]);

  const loadVersionData = async () => {
    setLoading(true);
    try {
      // Load both versions
      const { data: v1 } = await supabase
        .from('quotation_versions')
        .select('*')
        .eq('id', version1Id)
        .single();

      const { data: v2 } = await supabase
        .from('quotation_versions')
        .select('*')
        .eq('id', version2Id)
        .single();

      setVersion1(v1);
      setVersion2(v2);

      // Load options for both versions
      const { data: opts1 } = await supabase
        .from('quotation_version_options')
        .select('*, carrier_rates(carrier_name, currency)')
        .eq('quotation_version_id', version1Id);

      const { data: opts2 } = await supabase
        .from('quotation_version_options')
        .select('*, carrier_rates(carrier_name, currency)')
        .eq('quotation_version_id', version2Id);

      setOptions1(opts1?.map((o: any) => ({
        id: o.id,
        option_name: o.option_name,
        carrier_name: o.carrier_rates?.carrier_name || 'Unknown',
        total_amount: o.total_amount,
        currency: o.carrier_rates?.currency || 'USD',
        total_buy: o.total_buy,
        total_sell: o.total_sell,
        margin_amount: o.margin_amount,
        margin_percentage: o.margin_percentage,
        transit_time_days: o.transit_time_days,
      })) || []);

      setOptions2(opts2?.map((o: any) => ({
        id: o.id,
        option_name: o.option_name,
        carrier_name: o.carrier_rates?.carrier_name || 'Unknown',
        total_amount: o.total_amount,
        currency: o.carrier_rates?.currency || 'USD',
        total_buy: o.total_buy,
        total_sell: o.total_sell,
        margin_amount: o.margin_amount,
        margin_percentage: o.margin_percentage,
        transit_time_days: o.transit_time_days,
      })) || []);
    } catch (error) {
      console.error('Failed to load comparison data:', error);
    } finally {
      setLoading(false);
    }
  };

  const VersionColumn = ({ version, options }: { version: Version | null; options: Option[] }) => (
    <div className="flex-1 space-y-4">
      {version && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold">Version {version.version_number}</h3>
              <Badge variant={version.kind === 'major' ? 'default' : 'secondary'}>
                {version.kind}
              </Badge>
              <Badge variant="outline">{version.status || 'draft'}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Created: {new Date(version.created_at).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <h4 className="text-sm font-medium">Options ({options.length})</h4>
        {options.map((option) => (
          <Card key={option.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="font-medium">
                    {option.option_name || option.carrier_name}
                  </Badge>
                  {option.transit_time_days && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {option.transit_time_days} days
                    </span>
                  )}
                </div>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-semibold">
                      {option.currency} {Number(option.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {option.margin_amount !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        Margin:
                      </span>
                      <span className="font-medium text-primary">
                        {option.currency} {Number(option.margin_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        <span className="text-xs ml-1">({Number(option.margin_percentage).toFixed(1)}%)</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Version Comparison</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex gap-6">
            <VersionColumn version={version1} options={options1} />
            <div className="flex items-center justify-center">
              <ArrowRight className="w-6 h-6 text-muted-foreground" />
            </div>
            <VersionColumn version={version2} options={options2} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

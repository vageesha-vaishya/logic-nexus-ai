import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

type SequenceRow = {
  current_number: number | null;
  last_reset_bucket: string | null;
};

export default function SequencesAndPreview() {
  const { supabase, context } = useCRM();
  const tenantId = context?.tenantId || null;
  const franchiseId = context?.franchiseId || null;
  const [tenantSeq, setTenantSeq] = useState<SequenceRow | null>(null);
  const [franchiseSeq, setFranchiseSeq] = useState<SequenceRow | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canPreview = useMemo(() => !!tenantId || !!franchiseId, [tenantId, franchiseId]);

  useEffect(() => {
    const load = async () => {
      try {
        if (tenantId) {
          const { data } = await supabase
            .from('quote_sequences_tenant')
            .select('current_number,last_reset_bucket')
            .eq('tenant_id', tenantId)
            .maybeSingle();
          if (data) setTenantSeq(data as SequenceRow);
        }
        if (franchiseId) {
          const { data } = await supabase
            .from('quote_sequences_franchise')
            .select('current_number,last_reset_bucket')
            .eq('franchise_id', franchiseId)
            .maybeSingle();
          if (data) setFranchiseSeq(data as SequenceRow);
        }
      } catch (err: any) {
        toast.error('Failed to load sequences', { description: err.message });
      }
    };
    load();
  }, [tenantId, franchiseId]);

  const handlePreview = async () => {
    if (!canPreview) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('preview_next_quote_number', {
        tenant_id: tenantId,
        franchise_id: franchiseId,
        customer_id: null,
      });
      if (error) throw error;
      const next = typeof data === 'string' ? data : (data?.next_quote_number || JSON.stringify(data));
      setPreview(next);
      toast.success('Preview generated');
    } catch (err: any) {
      toast.error('Preview failed', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sequences & Preview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="font-medium mb-2">Tenant Sequence</div>
            {tenantId ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell className="font-medium">Current Number</TableCell>
                    <TableCell className="font-medium">Last Reset Bucket</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>{tenantSeq?.current_number ?? '-'}</TableCell>
                    <TableCell>{tenantSeq?.last_reset_bucket ?? '-'}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground">No tenant context available.</p>
            )}
          </div>

          <div>
            <div className="font-medium mb-2">Franchise Sequence</div>
            {franchiseId ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell className="font-medium">Current Number</TableCell>
                    <TableCell className="font-medium">Last Reset Bucket</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>{franchiseSeq?.current_number ?? '-'}</TableCell>
                    <TableCell>{franchiseSeq?.last_reset_bucket ?? '-'}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground">No franchise context available.</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button disabled={!canPreview || loading} onClick={handlePreview}>Preview Next Quote Number</Button>
          {preview && <div className="text-sm text-muted-foreground">Next: <span className="font-medium">{preview}</span></div>}
        </div>
      </CardContent>
    </Card>
  );
}
import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

type OpportunitySelectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (opportunity: any) => void;
};

const stageLabels: Record<string, string> = {
  prospecting: 'Prospecting',
  qualification: 'Qualification',
  needs_analysis: 'Needs Analysis',
  value_proposition: 'Value Proposition',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

const stageColors: Record<string, string> = {
  prospecting: 'bg-slate-500',
  qualification: 'bg-blue-500',
  needs_analysis: 'bg-cyan-500',
  value_proposition: 'bg-indigo-500',
  proposal: 'bg-purple-500',
  negotiation: 'bg-orange-500',
  closed_won: 'bg-green-500',
  closed_lost: 'bg-red-500',
};

export function OpportunitySelectDialog({ open, onOpenChange, onSelect }: OpportunitySelectDialogProps) {
  const { scopedDb } = useCRM();
  const [loading, setLoading] = useState(false);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [nameQuery, setNameQuery] = useState('');
  const [accountQuery, setAccountQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    const fetchOpportunities = async () => {
      setLoading(true);
      try {
        const { data, error } = await scopedDb
          .from('opportunities')
          .select(`
            *,
            accounts:account_id(name),
            contacts:contact_id(first_name, last_name)
          `)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setOpportunities(data || []);
      } catch (err: any) {
        toast.error('Failed to load opportunities', { description: err.message });
      } finally {
        setLoading(false);
      }
    };
    fetchOpportunities();
  }, [open, scopedDb]);

  const filtered = useMemo(() => {
    return opportunities.filter((o) => {
      const nameOk = nameQuery ? (o.name || '').toLowerCase().includes(nameQuery.toLowerCase()) : true;
      const accOk = accountQuery ? (o.accounts?.name || '').toLowerCase().includes(accountQuery.toLowerCase()) : true;
      return nameOk && accOk;
    });
  }, [opportunities, nameQuery, accountQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Select Opportunity</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search by name</label>
              <Input placeholder="Opportunity name" value={nameQuery} onChange={(e) => setNameQuery(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Search by account</label>
              <Input placeholder="Account name" value={accountQuery} onChange={(e) => setAccountQuery(e.target.value)} />
            </div>
          </div>

          {loading ? (
            <div className="text-center text-muted-foreground py-8">Loading opportunities…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No opportunities found</div>
          ) : (
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
              {filtered.map((o) => (
                <Card key={o.id} className="hover:shadow transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base truncate flex items-center justify-between">
                      <span title={o.name}>{o.name}</span>
                      {o.stage && (
                        <Badge className={`${stageColors[o.stage] || 'bg-muted'} text-white`}>
                          {stageLabels[o.stage] || o.stage}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground truncate">{o.accounts?.name || '-'}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {o.contacts ? `${o.contacts.first_name} ${o.contacts.last_name}` : '-'}
                    </div>
                    <div className="mt-3">
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          onSelect(o);
                          onOpenChange(false);
                        }}
                      >
                        Select
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default OpportunitySelectDialog;
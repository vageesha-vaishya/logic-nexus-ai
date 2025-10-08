import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
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

export default function OpportunitySelectDialogList({ open, onOpenChange, onSelect }: OpportunitySelectDialogProps) {
  const { supabase } = useCRM();
  const [loading, setLoading] = useState(false);
  const [opportunities, setOpportunities] = useState<any[]>([]);

  // Filters aligned with Opportunity form
  const [nameQuery, setNameQuery] = useState('');
  const [accountQuery, setAccountQuery] = useState('');
  const [stageAdv, setStageAdv] = useState<string>('any');
  const [amountMin, setAmountMin] = useState<string>('');
  const [amountMax, setAmountMax] = useState<string>('');
  const [closeStart, setCloseStart] = useState<string>('');
  const [closeEnd, setCloseEnd] = useState<string>('');
  const [probMin, setProbMin] = useState<string>('');
  const [probMax, setProbMax] = useState<string>('');
  const [leadSource, setLeadSource] = useState<string>('any');
  const [typeQuery, setTypeQuery] = useState<string>('');
  const [sort, setSort] = useState<string>('created_desc');

  useEffect(() => {
    if (!open) return;
    const fetch = async () => {
      setLoading(true);
      try {
        const { data, error } = await (supabase as any)
          .from('opportunities')
          .select('*, accounts(*), contacts(*)')
          .order('created_at', { ascending: false })
          .limit(200);
        if (error) throw error;
        setOpportunities(data || []);
      } catch (err: any) {
        console.error('Load opportunities failed:', err);
        toast.error('Failed to load opportunities');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [open, supabase]);

  const filtered = useMemo(() => {
    const res = opportunities.filter((o) => {
      const nameOk = nameQuery ? (o.name || '').toLowerCase().includes(nameQuery.toLowerCase()) : true;
      const accOk = accountQuery ? (o.accounts?.name || '').toLowerCase().includes(accountQuery.toLowerCase()) : true;
      const stageOk = stageAdv && stageAdv !== 'any' ? o.stage === stageAdv : true;
      const amountNum = Number(o.amount) || 0;
      const amountMinOk = amountMin ? amountNum >= Number(amountMin) : true;
      const amountMaxOk = amountMax ? amountNum <= Number(amountMax) : true;
      const closeDate = o.close_date ? new Date(o.close_date) : null;
      const closeStartOk = closeStart && closeDate ? closeDate >= new Date(closeStart) : !closeStart || !closeDate;
      const closeEndOk = closeEnd && closeDate ? closeDate <= new Date(closeEnd) : !closeEnd || !closeDate;
      const probNum = Number(o.probability) || 0;
      const probMinOk = probMin ? probNum >= Number(probMin) : true;
      const probMaxOk = probMax ? probNum <= Number(probMax) : true;
      const leadOk = leadSource && leadSource !== 'any' ? (o.lead_source === leadSource) : true;
      const typeOk = typeQuery ? (o.type || '').toLowerCase().includes(typeQuery.toLowerCase()) : true;
      return nameOk && accOk && stageOk && amountMinOk && amountMaxOk && closeStartOk && closeEndOk && probMinOk && probMaxOk && leadOk && typeOk;
    });
    res.sort((a, b) => {
      const dir = sort.endsWith('_desc') ? -1 : 1;
      if (sort.startsWith('name')) return ((a.name || '').localeCompare(b.name || '')) * dir;
      if (sort.startsWith('amount')) return ((Number(a.amount) || 0) - (Number(b.amount) || 0)) * dir;
      if (sort.startsWith('close')) return (((a.close_date ? new Date(a.close_date).getTime() : 0)) - ((b.close_date ? new Date(b.close_date).getTime() : 0))) * dir;
      if (sort.startsWith('prob')) return ((Number(a.probability) || 0) - (Number(b.probability) || 0)) * dir;
      if (sort.startsWith('created')) return (((new Date(a.created_at).getTime() || 0)) - ((new Date(b.created_at).getTime() || 0))) * dir;
      return 0;
    });
    return res;
  }, [opportunities, nameQuery, accountQuery, stageAdv, amountMin, amountMax, closeStart, closeEnd, probMin, probMax, leadSource, typeQuery, sort]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Select Opportunity</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input placeholder="Opportunity name" value={nameQuery} onChange={(e) => setNameQuery(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Account</Label>
              <Input placeholder="Account name" value={accountQuery} onChange={(e) => setAccountQuery(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Stage</Label>
              <Select value={stageAdv} onValueChange={setStageAdv}>
                <SelectTrigger><SelectValue placeholder="Any stage" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="prospecting">Prospecting</SelectItem>
                  <SelectItem value="qualification">Qualification</SelectItem>
                  <SelectItem value="needs_analysis">Needs Analysis</SelectItem>
                  <SelectItem value="value_proposition">Value Proposition</SelectItem>
                  <SelectItem value="proposal">Proposal</SelectItem>
                  <SelectItem value="negotiation">Negotiation</SelectItem>
                  <SelectItem value="closed_won">Closed Won</SelectItem>
                  <SelectItem value="closed_lost">Closed Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount range</Label>
              <div className="flex gap-2">
                <Input type="number" placeholder="Min" value={amountMin} onChange={(e) => setAmountMin(e.target.value)} />
                <Input type="number" placeholder="Max" value={amountMax} onChange={(e) => setAmountMax(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Close date range</Label>
              <div className="flex gap-2">
                <Input type="date" value={closeStart} onChange={(e) => setCloseStart(e.target.value)} />
                <Input type="date" value={closeEnd} onChange={(e) => setCloseEnd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Probability %</Label>
              <div className="flex gap-2">
                <Input type="number" placeholder="Min" value={probMin} onChange={(e) => setProbMin(e.target.value)} />
                <Input type="number" placeholder="Max" value={probMax} onChange={(e) => setProbMax(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Lead Source</Label>
              <Select value={leadSource} onValueChange={setLeadSource}>
                <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="social">Social</SelectItem>
                  <SelectItem value="event">Event</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Input placeholder="Type contains" value={typeQuery} onChange={(e) => setTypeQuery(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Sort</Label>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger><SelectValue placeholder="Sort" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_desc">Newest first</SelectItem>
                  <SelectItem value="created_asc">Oldest first</SelectItem>
                  <SelectItem value="name_asc">Name A→Z</SelectItem>
                  <SelectItem value="name_desc">Name Z→A</SelectItem>
                  <SelectItem value="amount_desc">Amount high→low</SelectItem>
                  <SelectItem value="amount_asc">Amount low→high</SelectItem>
                  <SelectItem value="close_desc">Close date latest→earliest</SelectItem>
                  <SelectItem value="close_asc">Close date earliest→latest</SelectItem>
                  <SelectItem value="prob_desc">Probability high→low</SelectItem>
                  <SelectItem value="prob_asc">Probability low→high</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="text-center text-muted-foreground py-8">Loading opportunities…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No opportunities found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell className="font-medium">Name</TableCell>
                    <TableCell className="font-medium">Account</TableCell>
                    <TableCell className="font-medium">Contact</TableCell>
                    <TableCell className="font-medium">Stage</TableCell>
                    <TableCell className="font-medium">Amount</TableCell>
                    <TableCell className="font-medium">Close Date</TableCell>
                    <TableCell className="font-medium">Probability</TableCell>
                    <TableCell className="font-medium">Action</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((o) => (
                    <TableRow key={o.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{o.name}</TableCell>
                      <TableCell>{o.accounts?.name || '-'}</TableCell>
                      <TableCell>{o.contacts ? `${o.contacts.first_name} ${o.contacts.last_name}` : '-'}</TableCell>
                      <TableCell>
                        {o.stage ? (
                          <Badge className={`${stageColors[o.stage] || 'bg-muted'} text-white`}>{stageLabels[o.stage] || o.stage}</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell>{o.amount != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(o.amount) || 0) : '-'}</TableCell>
                      <TableCell>{o.close_date ? new Date(o.close_date).toLocaleDateString() : '-'}</TableCell>
                      <TableCell>{o.probability != null ? `${o.probability}%` : '-'}</TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => { onSelect(o); onOpenChange(false); }}>Select</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
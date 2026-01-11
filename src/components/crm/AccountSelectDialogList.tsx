import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

type AccountSelectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (account: any) => void;
};

export default function AccountSelectDialogList({ open, onOpenChange, onSelect }: AccountSelectDialogProps) {
  const { scopedDb } = useCRM();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);

  const [nameQuery, setNameQuery] = useState('');
  const [emailQuery, setEmailQuery] = useState('');
  const [phoneQuery, setPhoneQuery] = useState('');
  const [industryQuery, setIndustryQuery] = useState('');
  const [statusAdv, setStatusAdv] = useState<string>('any');
  const [sort, setSort] = useState<string>('name_asc');

  useEffect(() => {
    if (!open) return;
    const fetch = async () => {
      setLoading(true);
      try {
        const { data, error } = await scopedDb
          .from('accounts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200);
        if (error) throw error;
        setAccounts(data || []);
      } catch (err: any) {
        console.error('Load accounts failed:', err);
        toast.error('Failed to load accounts');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [open, scopedDb]);

  const filtered = useMemo(() => {
    const res = accounts.filter((a) => {
      const nameOk = nameQuery ? (a.name || '').toLowerCase().includes(nameQuery.toLowerCase()) : true;
      const emailOk = emailQuery ? (a.email || '').toLowerCase().includes(emailQuery.toLowerCase()) : true;
      const phoneOk = phoneQuery ? (a.phone || '').toLowerCase().includes(phoneQuery.toLowerCase()) : true;
      const industryOk = industryQuery ? (a.industry || '').toLowerCase().includes(industryQuery.toLowerCase()) : true;
      const statusOk = statusAdv && statusAdv !== 'any' ? a.status === statusAdv : true;
      return nameOk && emailOk && phoneOk && industryOk && statusOk;
    });
    res.sort((a, b) => {
      const dir = sort.endsWith('_desc') ? -1 : 1;
      if (sort.startsWith('name')) return ((a.name || '').localeCompare(b.name || '')) * dir;
      if (sort.startsWith('created')) return ((new Date(a.created_at).getTime() || 0) - (new Date(b.created_at).getTime() || 0)) * dir;
      return 0;
    });
    return res;
  }, [accounts, nameQuery, emailQuery, phoneQuery, industryQuery, statusAdv, sort]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Select Account</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input placeholder="Account name" value={nameQuery} onChange={(e) => setNameQuery(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input placeholder="Email" value={emailQuery} onChange={(e) => setEmailQuery(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input placeholder="Phone" value={phoneQuery} onChange={(e) => setPhoneQuery(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Industry</Label>
              <Input placeholder="Industry" value={industryQuery} onChange={(e) => setIndustryQuery(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusAdv} onValueChange={setStatusAdv}>
                <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sort</Label>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger><SelectValue placeholder="Sort" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="name_asc">Name A→Z</SelectItem>
                  <SelectItem value="name_desc">Name Z→A</SelectItem>
                  <SelectItem value="created_desc">Newest first</SelectItem>
                  <SelectItem value="created_asc">Oldest first</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="text-center text-muted-foreground py-8">Loading accounts…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No accounts found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell className="font-medium">Name</TableCell>
                    <TableCell className="font-medium">Email</TableCell>
                    <TableCell className="font-medium">Phone</TableCell>
                    <TableCell className="font-medium">Action</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => (
                    <TableRow key={a.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell>{a.email || '-'}</TableCell>
                      <TableCell>{a.phone || '-'}</TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => { onSelect(a); onOpenChange(false); }}>Select</Button>
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
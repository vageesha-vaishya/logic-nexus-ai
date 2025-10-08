import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

type ContactSelectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (contact: any) => void;
};

export default function ContactSelectDialogList({ open, onOpenChange, onSelect }: ContactSelectDialogProps) {
  const { supabase } = useCRM();
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);

  const [nameQuery, setNameQuery] = useState('');
  const [emailQuery, setEmailQuery] = useState('');
  const [phoneQuery, setPhoneQuery] = useState('');
  const [accountFilter, setAccountFilter] = useState<string>('any');
  const [statusAdv, setStatusAdv] = useState<string>('any');
  const [sort, setSort] = useState<string>('name_asc');

  useEffect(() => {
    if (!open) return;
    const fetch = async () => {
      setLoading(true);
      try {
        const { data: contactsData, error: contactsErr } = await (supabase as any)
          .from('contacts')
          .select('*, accounts(*)')
          .order('created_at', { ascending: false })
          .limit(200);
        if (contactsErr) throw contactsErr;
        const { data: accountsData, error: accountsErr } = await (supabase as any)
          .from('accounts')
          .select('id, name')
          .order('name', { ascending: true })
          .limit(200);
        if (accountsErr) throw accountsErr;
        setContacts(contactsData || []);
        setAccounts(accountsData || []);
      } catch (err: any) {
        console.error('Load contacts failed:', err);
        toast.error('Failed to load contacts');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [open, supabase]);

  const filtered = useMemo(() => {
    const res = contacts.filter((c) => {
      const name = `${c.first_name || ''} ${c.last_name || ''}`.trim();
      const nameOk = nameQuery ? name.toLowerCase().includes(nameQuery.toLowerCase()) : true;
      const emailOk = emailQuery ? (c.email || '').toLowerCase().includes(emailQuery.toLowerCase()) : true;
      const phoneOk = phoneQuery ? (c.phone || '').toLowerCase().includes(phoneQuery.toLowerCase()) : true;
      const accOk = accountFilter && accountFilter !== 'any' ? String(c.account_id) === accountFilter : true;
      const statusOk = statusAdv && statusAdv !== 'any' ? c.status === statusAdv : true;
      return nameOk && emailOk && phoneOk && accOk && statusOk;
    });
    res.sort((a, b) => {
      const dir = sort.endsWith('_desc') ? -1 : 1;
      const nameA = `${a.first_name || ''} ${a.last_name || ''}`.trim();
      const nameB = `${b.first_name || ''} ${b.last_name || ''}`.trim();
      if (sort.startsWith('name')) return nameA.localeCompare(nameB) * dir;
      if (sort.startsWith('created')) return ((new Date(a.created_at).getTime() || 0) - (new Date(b.created_at).getTime() || 0)) * dir;
      return 0;
    });
    return res;
  }, [contacts, nameQuery, emailQuery, phoneQuery, accountFilter, statusAdv, sort]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Select Contact</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input placeholder="First/Last name" value={nameQuery} onChange={(e) => setNameQuery(e.target.value)} />
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
              <Label>Account</Label>
              <Select value={accountFilter} onValueChange={setAccountFilter}>
                <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <div className="text-center text-muted-foreground py-8">Loading contacts…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No contacts found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell className="font-medium">Name</TableCell>
                    <TableCell className="font-medium">Email</TableCell>
                    <TableCell className="font-medium">Phone</TableCell>
                    <TableCell className="font-medium">Account</TableCell>
                    <TableCell className="font-medium">Action</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{`${c.first_name || ''} ${c.last_name || ''}`.trim() || '-'}</TableCell>
                      <TableCell>{c.email || '-'}</TableCell>
                      <TableCell>{c.phone || '-'}</TableCell>
                      <TableCell>{c.accounts?.name || '-'}</TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => { onSelect(c); onOpenChange(false); }}>Select</Button>
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
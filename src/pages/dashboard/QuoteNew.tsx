import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '@/hooks/useCRM';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function QuoteNew() {
  const navigate = useNavigate();
  const { supabase, context } = useCRM();
  const [customerId, setCustomerId] = useState('');
  const [contactId, setContactId] = useState('');
  const [opportunityId, setOpportunityId] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [tenants, setTenants] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');

  useEffect(() => {
    const fetchTenants = async () => {
      if (!context.isPlatformAdmin) return;
      try {
        const { data, error } = await supabase
          .from('tenants')
          .select('id, name')
          .eq('is_active', true)
          .order('name');
        if (error) throw error;
        setTenants(data || []);
      } catch (err: any) {
        console.error('Failed to load tenants:', err.message);
      }
    };
    fetchTenants();
  }, [context.isPlatformAdmin]);

  const handleCreate = async () => {
    try {
      // Resolve tenant and franchise scope
      let tenantId = context.tenantId || selectedTenantId || null;
      let franchiseId = context.franchiseId || null;

      if (!tenantId) {
        if (customerId) {
          const { data: account } = await supabase
            .from('accounts')
            .select('tenant_id, franchise_id')
            .eq('id', customerId)
            .single();
          if (account) {
            tenantId = account.tenant_id;
            franchiseId = account.franchise_id;
          }
        } else if (contactId) {
          const { data: contact } = await supabase
            .from('contacts')
            .select('tenant_id, franchise_id, account_id')
            .eq('id', contactId)
            .single();
          if (contact) {
            tenantId = contact.tenant_id;
            franchiseId = contact.franchise_id;
          }
        }
      }

      if (!tenantId) {
        throw new Error('Unable to determine tenant for this quote. Please select a tenant (Platform Admin) or a customer/contact belonging to a tenant.');
      }

      const quoteNumber = `Q-${Math.random().toString(36).slice(2,8).toUpperCase()}`;

      const { data, error } = await supabase
        .from('quotes')
        .insert({
          tenant_id: tenantId,
          franchise_id: franchiseId || null,
          account_id: customerId || null,
          contact_id: contactId || null,
          opportunity_id: opportunityId || null,
          is_primary: isPrimary || false,
          quote_number: quoteNumber,
          created_by: context.userId || null,
          status: 'draft',
        } as any)
        .select('*')
        .single();
      if (error) throw error;
      toast.success('Quote created');
      navigate(`/dashboard/quotes/${data.id}`);
    } catch (err: any) {
      toast.error('Failed to create quote', { description: err.message });
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">New Quote</h1>
          <p className="text-muted-foreground">Start a quotation</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>RFQ Basics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {context.isPlatformAdmin && (
              <div>
                <Label htmlFor="tenant">Tenant</Label>
                <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                  <SelectTrigger id="tenant" className="w-full">
                    <SelectValue placeholder="Select a tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label htmlFor="customer">Customer ID</Label>
              <Input id="customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="Account UUID" />
            </div>
            <div>
              <Label htmlFor="contact">Contact ID</Label>
              <Input id="contact" value={contactId} onChange={(e) => setContactId(e.target.value)} placeholder="Contact UUID" />
            </div>
            <div>
              <Label htmlFor="opportunity">Opportunity ID</Label>
              <Input id="opportunity" value={opportunityId} onChange={(e) => setOpportunityId(e.target.value)} placeholder="Opportunity UUID" />
              <p className="text-xs text-muted-foreground mt-1">Link this quote to an opportunity.</p>
            </div>
            <div className="flex items-center gap-2">
              <input id="primaryQuote" type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
              <Label htmlFor="primaryQuote">Set as primary for the opportunity</Label>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate}>Create Quote</Button>
              <Button variant="outline" onClick={() => navigate('/dashboard/quotes')}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

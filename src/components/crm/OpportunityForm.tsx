import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCRM } from '@/hooks/useCRM';
import { ScopedDataAccess, DataAccessContext } from '@/lib/db/access';
import { stageProbabilityMap, OpportunityStage } from '@/pages/dashboard/opportunities-data';

const opportunitySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  stage: z.enum(['prospecting', 'qualification', 'needs_analysis', 'value_proposition', 'proposal', 'negotiation', 'closed_won', 'closed_lost']),
  amount: z.string().optional(),
  probability: z.string().optional().refine(val => {
    if (!val) return true;
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 100;
  }, "Probability must be between 0 and 100"),
  close_date: z.string().optional(),
  account_id: z.string().optional(),
  contact_id: z.string().optional(),
  lead_id: z.string().optional(),
  // Align lead_source options with the shared enum used across Leads and Opportunities
  lead_source: z.enum(['website', 'referral', 'email', 'phone', 'social', 'event', 'other']).optional(),
  next_step: z.string().optional(),
  competitors: z.string().optional(),
  type: z.string().optional(),
  forecast_category: z.string().optional(),
  tenant_id: z.string().optional(),
  franchise_id: z.string().optional(),
});

type OpportunityFormData = z.infer<typeof opportunitySchema>;

interface OpportunityFormProps {
  opportunity?: any;
  onSubmit: (data: OpportunityFormData) => Promise<void>;
  onCancel: () => void;
}

const stageLabels = {
  prospecting: 'Prospecting',
  qualification: 'Qualification',
  needs_analysis: 'Needs Analysis',
  value_proposition: 'Value Proposition',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

export function OpportunityForm({ opportunity, onSubmit, onCancel }: OpportunityFormProps) {
  const { context } = useCRM();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);

  const form = useForm<OpportunityFormData>({
    resolver: zodResolver(opportunitySchema),
    defaultValues: {
      name: opportunity?.name || '',
      description: opportunity?.description || '',
      stage: opportunity?.stage || 'prospecting',
      amount: opportunity?.amount?.toString() || '',
      probability: opportunity?.probability?.toString() || '',
      close_date: opportunity?.close_date || '',
      account_id: opportunity?.account_id || '',
      contact_id: opportunity?.contact_id || '',
      lead_id: opportunity?.lead_id || '',
      lead_source: opportunity?.lead_source || undefined,
      next_step: opportunity?.next_step || '',
      competitors: opportunity?.competitors || '',
      type: opportunity?.type || '',
      forecast_category: opportunity?.forecast_category || '',
      tenant_id: opportunity?.tenant_id || '',
      franchise_id: opportunity?.franchise_id || '',
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      const dao = new ScopedDataAccess(supabase, context as unknown as DataAccessContext);
      
      // Fetch accounts
      const { data: accountsData } = await dao
        .from('accounts')
        .select('id, name')
        .order('name');
      if (accountsData) setAccounts(accountsData);

      // Fetch contacts (include account_id for filtering)
      const { data: contactsData } = await dao
        .from('contacts')
        .select('id, first_name, last_name, account_id')
        .order('first_name');
      if (contactsData) setContacts(contactsData);

      // Fetch leads
      const { data: leadsData } = await dao
        .from('leads')
        .select('id, first_name, last_name, company')
        .order('first_name');
      if (leadsData) setLeads(leadsData);

      // Fetch tenants for platform admin
      if (context.isPlatformAdmin) {
        const { data: tenantsData } = await dao
          .from('tenants')
          .select('id, name')
          .eq('is_active', true)
          .order('name');
        if (tenantsData) setTenants(tenantsData);
      }

      // Fetch franchises for platform admin and tenant admin
      if (context.isPlatformAdmin || context.isTenantAdmin) {
        let query = dao
          .from('franchises')
          .select('id, name, code')
          .eq('is_active', true);
        
        if (context.isTenantAdmin && context.tenantId) {
          query = query.eq('tenant_id', context.tenantId);
        }
        
        const { data: franchisesData } = await query.order('name');
        if (franchisesData) setFranchises(franchisesData);
      }
    };

    fetchData();
  }, [context]);

  // Filter contacts by selected account
  const selectedAccountId = form.watch('account_id');
  const filteredContacts = useMemo(() => {
    if (!selectedAccountId) return contacts;
    return contacts.filter((c) => c.account_id === selectedAccountId);
  }, [selectedAccountId, contacts]);

  // Reset contact if it no longer matches the selected account
  useEffect(() => {
    const currentContactId = form.getValues('contact_id');
    if (!currentContactId) return;
    const current = contacts.find((c) => c.id === currentContactId);
    if (selectedAccountId && current && current.account_id !== selectedAccountId) {
      form.setValue('contact_id', '');
    }
  }, [selectedAccountId, contacts]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Opportunity Name *</FormLabel>
                <FormControl>
                  <Input placeholder="Enter opportunity name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="stage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stage</FormLabel>
                <Select 
                  onValueChange={(val) => {
                    field.onChange(val);
                    if (stageProbabilityMap[val as OpportunityStage] !== undefined) {
                       form.setValue('probability', stageProbabilityMap[val as OpportunityStage].toString());
                    }
                  }} 
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(stageLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="0.00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="probability"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Probability (%)</FormLabel>
                <FormControl>
                  <Input type="number" min="0" max="100" placeholder="0-100" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="close_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Expected Close Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="account_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Account</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contact_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Primary Contact</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select contact" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {filteredContacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.first_name} {contact.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lead_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Related Lead</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select lead" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {leads.map((lead) => (
                      <SelectItem key={lead.id} value={lead.id}>
                        {lead.first_name} {lead.last_name} {lead.company ? `- ${lead.company}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lead_source"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lead Source</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select lead source" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="social">Social</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <FormControl>
                  <Input placeholder="New Business, Upsell, Renewal, etc." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="forecast_category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Forecast Category</FormLabel>
                <FormControl>
                  <Input placeholder="Pipeline, Best Case, Commit, etc." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {context.isPlatformAdmin && (
            <FormField
              control={form.control}
              name="tenant_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tenant *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select tenant" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {tenants.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {(context.isPlatformAdmin || context.isTenantAdmin) && (
            <FormField
              control={form.control}
              name="franchise_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Franchise</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select franchise" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {franchises.map((franchise) => (
                        <SelectItem key={franchise.id} value={franchise.id}>
                          {franchise.code} - {franchise.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter opportunity description"
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="next_step"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Next Step</FormLabel>
              <FormControl>
                <Input placeholder="What's the next action?" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="competitors"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Competitors</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="List competing companies or solutions"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">Save Opportunity</Button>
        </div>
      </form>
    </Form>
  );
}
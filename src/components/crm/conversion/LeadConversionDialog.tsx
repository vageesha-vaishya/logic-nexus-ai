import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { leadConversionSchema, LeadConversionValues } from './schema';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';

interface LeadConversionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: {
    id: string;
    first_name: string;
    last_name: string;
    company?: string | null;
    email?: string | null;
    phone?: string | null;
    title?: string | null;
    tenant_id?: string | null;
    franchise_id?: string | null;
    estimated_value?: number | null;
    expected_close_date?: string | null;
    source?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
  };
  onConversionComplete: () => void;
}

export function LeadConversionDialog({ open, onOpenChange, lead, onConversionComplete }: LeadConversionDialogProps) {
  const { supabase, context } = useCRM();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [accountOpen, setAccountOpen] = useState(true);
  const [contactOpen, setContactOpen] = useState(false);
  const [opportunityOpen, setOpportunityOpen] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingValues, setPendingValues] = useState<LeadConversionValues | null>(null);

  // Initialize form with lead data
  const form = useForm<LeadConversionValues>({
    resolver: zodResolver(leadConversionSchema),
    defaultValues: {
      createAccount: !!lead?.company,
      accountName: lead?.company || '',
      accountEmail: '',
      accountPhone: lead?.phone || '',
      accountAddress: '',
      accountCity: lead?.city || '',
      accountState: lead?.state || '',
      accountZip: '',
      accountCountry: lead?.country || '',
      accountWebsite: '',
      industry: '',

      createContact: true,
      firstName: lead?.first_name || '',
      lastName: lead?.last_name || '',
      contactEmail: lead?.email || '',
      contactPhone: lead?.phone || '',
      contactTitle: lead?.title || '',

      createOpportunity: true,
      opportunityName: lead ? `${lead.first_name} ${lead.last_name} Opportunity` : '',
      opportunityAmount: lead?.estimated_value || 0,
      opportunityCloseDate: lead?.expected_close_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      opportunityStage: 'prospecting',
      
      notes: '',
    },
  });

  // Reset form when lead changes or dialog opens
  useEffect(() => {
    if (open && lead) {
      form.reset({
        createAccount: !!lead.company,
        accountName: lead.company || '',
        accountEmail: '',
        accountPhone: lead.phone || '',
        accountAddress: '',
        accountCity: lead.city || '',
        accountState: lead.state || '',
        accountZip: '',
        accountCountry: lead.country || '',
        accountWebsite: '',
        industry: '',

        createContact: true,
        firstName: lead.first_name || '',
        lastName: lead.last_name || '',
        contactEmail: lead.email || '',
        contactPhone: lead.phone || '',
        contactTitle: lead.title || '',

        createOpportunity: true,
        opportunityName: `${lead.first_name} ${lead.last_name} Opportunity`,
        opportunityAmount: lead.estimated_value || 0,
        opportunityCloseDate: lead.expected_close_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        opportunityStage: 'prospecting',
        
        notes: '',
      });
    }
  }, [open, lead, form]);

  const handleFormSubmit = async (values: LeadConversionValues) => {
    setPendingValues(values);
    setShowConfirmDialog(true);
  };

  const confirmConversion = async () => {
    if (!pendingValues) return;
    setLoading(true);
    
    // Close confirm dialog to show loading state on main dialog or keep it open?
    // Let's keep confirm dialog open with loading state
    
    try {
      const {
        createAccount,
        createContact,
        createOpportunity,
        accountName, accountEmail, accountPhone, accountAddress, accountCity, accountState, accountZip, accountCountry, accountWebsite, industry,
        firstName, lastName, contactEmail, contactPhone, contactTitle,
        opportunityName, opportunityAmount, opportunityCloseDate, opportunityStage
      } = pendingValues;

      // Prepare payloads
      const accountPayload = createAccount ? {
        name: accountName,
        email: accountEmail || null,
        phone: accountPhone || null,
        website: accountWebsite || null,
        billing_street: accountAddress || null,
        billing_city: accountCity || null,
        billing_state: accountState || null,
        billing_postal_code: accountZip || null,
        billing_country: accountCountry || null,
        industry: industry || null,
      } : null;

      const contactPayload = createContact ? {
        first_name: firstName,
        last_name: lastName,
        email: contactEmail || null,
        phone: contactPhone || null,
        title: contactTitle || null,
      } : null;

      const opportunityPayload = createOpportunity ? {
        name: opportunityName,
        amount: opportunityAmount || 0,
        close_date: opportunityCloseDate || null,
        stage: opportunityStage || 'prospecting',
      } : null;

      // Client-side conversion logic (RPC fallback)
      let newAccountId: string | null = null;
      let newContactId: string | null = null;
      let newOpportunityId: string | null = null;

      const tenantId = lead.tenant_id || context.tenantId;
      const franchiseId = lead.franchise_id || context.franchiseId;

      // 1. Create Account
      if (createAccount && accountPayload) {
        const { data: accData, error: accError } = await supabase
          .from('accounts')
          .insert({
            ...accountPayload,
            tenant_id: tenantId,
            franchise_id: franchiseId,
            created_by: context.userId,
            owner_id: context.userId,
            status: 'active'
          })
          .select('id')
          .single();
        
        if (accError) throw new Error(`Failed to create account: ${accError.message}`);
        newAccountId = accData.id;
      }

      // 2. Create Contact
      if (createContact && contactPayload) {
        const { data: conData, error: conError } = await supabase
          .from('contacts')
          .insert({
            ...contactPayload,
            account_id: newAccountId,
            tenant_id: tenantId,
            franchise_id: franchiseId,
            created_by: context.userId,
            owner_id: context.userId
          })
          .select('id')
          .single();
        
        if (conError) throw new Error(`Failed to create contact: ${conError.message}`);
        newContactId = conData.id;
      }

      // 3. Create Opportunity
      if (createOpportunity && opportunityPayload) {
        const { data: oppData, error: oppError } = await supabase
          .from('opportunities')
          .insert({
            ...opportunityPayload,
            account_id: newAccountId,
            contact_id: newContactId,
            tenant_id: tenantId,
            franchise_id: franchiseId,
            created_by: context.userId,
            owner_id: context.userId
          })
          .select('id')
          .single();
        
        if (oppError) throw new Error(`Failed to create opportunity: ${oppError.message}`);
        newOpportunityId = oppData.id;
      }

      // 4. Update Lead
      // Note: We only update fields that exist in the schema.
      // 'converted_by' and 'is_converted' are not present in the leads table definition.
      // 'converted_opportunity_id' is also not present in the base schema, so we omit it to avoid errors.
      const { error: leadError } = await supabase
        .from('leads')
        .update({
          status: 'converted',
          converted_account_id: newAccountId,
          converted_contact_id: newContactId,
          converted_at: new Date().toISOString()
        })
        .eq('id', lead.id);

      if (leadError) throw new Error(`Failed to update lead status: ${leadError.message}`);

      // 5. Transfer Activities (if any)
      // We update activities linked to this lead to point to the new entities
      const { error: actError } = await supabase
        .from('activities')
        .update({
          account_id: newAccountId || undefined, // Only update if created
          contact_id: newContactId || undefined,
          opportunity_id: newOpportunityId || undefined
        })
        .eq('lead_id', lead.id);

      if (actError) {
          console.warn('Failed to transfer activities:', actError);
          // Don't fail the whole process for activities, just log warning
      }

      // Construct return data for navigation
      const data = {
        account_id: newAccountId,
        contact_id: newContactId,
        opportunity_id: newOpportunityId
      };

      toast.success('Lead converted successfully!');
      
      // Close both dialogs
      setShowConfirmDialog(false);
      onOpenChange(false);
      onConversionComplete();

      // Navigate to new opportunity if created
      if (data && data.opportunity_id) {
        navigate(`/dashboard/opportunities/${data.opportunity_id}`);
      } else if (data && data.account_id) {
        navigate(`/dashboard/accounts/${data.account_id}`);
      }

    } catch (error: any) {
      console.error('Conversion failed:', error);
      toast.error('Failed to convert lead: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const createAccountChecked = form.watch('createAccount');
  const createContactChecked = form.watch('createContact');
  const createOpportunityChecked = form.watch('createOpportunity');

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convert Lead</DialogTitle>
          <DialogDescription>
            Review and edit details before converting this lead.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6 py-4">
            
            {/* Account Section */}
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <FormField
                  control={form.control}
                  name="createAccount"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="font-semibold text-base">Create Account</FormLabel>
                    </FormItem>
                  )}
                />
                <Button variant="ghost" size="sm" type="button" onClick={() => setAccountOpen(!accountOpen)}>
                  {accountOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>

              <Collapsible open={accountOpen && createAccountChecked}>
                <CollapsibleContent className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="accountName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Name *</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="industry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Industry</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g. Logistics" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="accountPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="accountWebsite"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="https://..." />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="accountAddress"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Billing Address</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Street Address" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="accountCity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="accountState"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State/Province</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="accountZip"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Postal Code</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="accountCountry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Contact Section */}
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <FormField
                  control={form.control}
                  name="createContact"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="font-semibold text-base">Create Contact</FormLabel>
                    </FormItem>
                  )}
                />
                <Button variant="ghost" size="sm" type="button" onClick={() => setContactOpen(!contactOpen)}>
                  {contactOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>

              <Collapsible open={contactOpen && createContactChecked}>
                <CollapsibleContent className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name *</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name *</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contactEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contactPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contactTitle"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Job Title</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Opportunity Section */}
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <FormField
                  control={form.control}
                  name="createOpportunity"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="font-semibold text-base">Create Opportunity</FormLabel>
                    </FormItem>
                  )}
                />
                <Button variant="ghost" size="sm" type="button" onClick={() => setOpportunityOpen(!opportunityOpen)}>
                  {opportunityOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>

              <Collapsible open={opportunityOpen && createOpportunityChecked}>
                <CollapsibleContent className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="opportunityName"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Opportunity Name *</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="opportunityAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estimated Value</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" onChange={e => field.onChange(parseFloat(e.target.value))} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="opportunityCloseDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Expected Close Date</FormLabel>
                          <FormControl>
                            <Input {...field} type="date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Convert Lead
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Conversion</DialogTitle>
          <DialogDescription>
            Please review the entities that will be created:
          </DialogDescription>
        </DialogHeader>
        
        {pendingValues && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              {pendingValues.createAccount && (
                <div className="flex items-center gap-2">
                  <Checkbox checked disabled />
                  <span>Create Account: <strong>{pendingValues.accountName}</strong></span>
                </div>
              )}
              
              {pendingValues.createContact && (
                <div className="flex items-center gap-2">
                  <Checkbox checked disabled />
                  <span>Create Contact: <strong>{pendingValues.firstName} {pendingValues.lastName}</strong></span>
                </div>
              )}
              
              {pendingValues.createOpportunity && (
                <div className="flex items-center gap-2">
                  <Checkbox checked disabled />
                  <span>Create Opportunity: <strong>{pendingValues.opportunityName}</strong></span>
                </div>
              )}
            </div>
            
            <div className="bg-muted p-3 rounded text-sm text-muted-foreground">
              This action will mark the lead as converted and cannot be easily undone.
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>Cancel</Button>
          <Button onClick={confirmConversion} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm & Convert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

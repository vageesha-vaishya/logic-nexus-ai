import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { OpportunityStage, buildOpportunityFromLead } from '@/pages/dashboard/opportunities-data';

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
  };
  onConversionComplete: () => void;
}

export function LeadConversionDialog({ open, onOpenChange, lead, onConversionComplete }: LeadConversionDialogProps) {
  const { supabase, context } = useCRM();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [createAccount, setCreateAccount] = useState(true);
  const [createContact, setCreateContact] = useState(true);
  const [createOpportunity, setCreateOpportunity] = useState(true);
  const [opportunityName, setOpportunityName] = useState('');

  // Guard against null lead
  if (!lead) return null;

  const handleConvert = async () => {
    setLoading(true);
    try {
      // Resolve tenant and franchise IDs.
      // Tenant is required; franchise is optional in schemas but may be used by RLS.
      let effectiveTenantId: string | undefined = context.tenantId || lead.tenant_id || undefined;
      let effectiveFranchiseId: string | null = context.franchiseId || lead.franchise_id || null;

      // Fallback to RPC to get tenant/franchise when missing
      if (!effectiveTenantId && context.userId) {
        const { data: tenantRpc, error: tenantErr } = await supabase
          .rpc('get_user_tenant_id', { check_user_id: context.userId });
        if (tenantErr) {
          console.warn('tenant rpc error', tenantErr);
        }
        if (tenantRpc) effectiveTenantId = tenantRpc as string;
      }
      if (!effectiveFranchiseId && context.userId) {
        const { data: franchiseRpc, error: franchiseErr } = await supabase
          .rpc('get_user_franchise_id', { check_user_id: context.userId });
        if (franchiseErr) {
          console.warn('franchise rpc error', franchiseErr);
        }
        if (franchiseRpc) effectiveFranchiseId = franchiseRpc as string;
      }

      if (!effectiveTenantId) {
        throw new Error('Missing tenant context for conversion');
      }

      let accountId: string | null = null;
      let contactId: string | null = null;
      let opportunityId: string | null = null;

      // Create Account if requested
      if (createAccount && lead.company) {
        const { data: accountData, error: accountError } = await supabase
          .from('accounts')
          .insert({
            name: lead.company,
            tenant_id: effectiveTenantId,
            franchise_id: effectiveFranchiseId,
            email: lead.email,
            phone: lead.phone,
            status: 'active',
          })
          .select()
          .single();

        if (accountError) throw accountError;
        accountId = accountData.id;
      }

      // Create Contact if requested
      if (createContact) {
        const { data: contactData, error: contactError } = await supabase
          .from('contacts')
          .insert({
            first_name: lead.first_name,
            last_name: lead.last_name,
            email: lead.email,
            phone: lead.phone,
            title: lead.title,
            account_id: accountId,
            tenant_id: effectiveTenantId,
            franchise_id: effectiveFranchiseId,
          })
          .select()
          .single();

        if (contactError) throw contactError;
        contactId = contactData.id;
      }

      // Create Opportunity if requested
      if (createOpportunity) {
        const oppInsert = buildOpportunityFromLead({
          lead,
          name: opportunityName,
          tenant_id: effectiveTenantId,
          franchise_id: effectiveFranchiseId,
          account_id: accountId,
          contact_id: contactId,
        });
        const { data: oppData, error: oppError } = await supabase
          .from('opportunities')
          .insert(oppInsert)
          .select()
          .single();

        if (oppError) throw oppError;
        opportunityId = oppData.id;
      }

      // Update lead with conversion info
      const { error: leadError } = await supabase
        .from('leads')
        .update({
          status: 'converted',
          converted_at: new Date().toISOString(),
          converted_account_id: accountId,
          converted_contact_id: contactId,
        })
        .eq('id', lead.id);

      if (leadError) throw leadError;

      // Transfer activities to the new entities
      const activityUpdatePayload: any = {};
      if (accountId) activityUpdatePayload.account_id = accountId;
      if (contactId) activityUpdatePayload.contact_id = contactId;
      if (opportunityId) activityUpdatePayload.opportunity_id = opportunityId;

      if (Object.keys(activityUpdatePayload).length > 0) {
        const { error: activityError } = await supabase
          .from('activities')
          .update(activityUpdatePayload)
          .eq('lead_id', lead.id);
        
        if (activityError) {
          console.error('Failed to transfer activities:', activityError);
          toast.warning('Lead converted, but activities could not be transferred.');
        }
      }

      toast.success('Lead converted successfully!');
      onOpenChange(false);
      onConversionComplete();
      
      // Navigate to the created opportunity if available
      if (opportunityId) {
        navigate(`/dashboard/opportunities/${opportunityId}`);
      }
    } catch (error: unknown) {
      const message =
        typeof error === 'object' && error && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Failed to convert lead';
      toast.error(message);
      console.error('Convert lead error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convert Lead</DialogTitle>
          <DialogDescription>
            Convert this lead into an account, contact, and opportunity
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="account" 
                checked={createAccount}
                onCheckedChange={(checked) => setCreateAccount(checked as boolean)}
                disabled={!lead.company}
              />
              <Label htmlFor="account" className="text-sm font-medium">
                Create Account {!lead.company && '(No company specified)'}
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="contact" 
                checked={createContact}
                onCheckedChange={(checked) => setCreateContact(checked as boolean)}
              />
              <Label htmlFor="contact" className="text-sm font-medium">
                Create Contact
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="opportunity" 
                checked={createOpportunity}
                onCheckedChange={(checked) => setCreateOpportunity(checked as boolean)}
              />
              <Label htmlFor="opportunity" className="text-sm font-medium">
                Create Opportunity
              </Label>
            </div>
          </div>

          {createOpportunity && (
            <div className="space-y-2">
              <Label htmlFor="oppName">Opportunity Name</Label>
              <Input
                id="oppName"
                placeholder="Enter opportunity name"
                value={opportunityName}
                onChange={(e) => setOpportunityName(e.target.value)}
              />
            </div>
          )}

          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="font-medium mb-2">Conversion Summary:</p>
            <ul className="space-y-1 text-muted-foreground">
              {createAccount && lead.company && <li>• Account: {lead.company}</li>}
              {createContact && <li>• Contact: {lead.first_name} {lead.last_name}</li>}
              {createOpportunity && <li>• Opportunity: {opportunityName || `${lead.first_name} ${lead.last_name} Opportunity`}</li>}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleConvert} disabled={loading || (!createAccount && !createContact && !createOpportunity)}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Convert Lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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

interface LeadConversionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: any;
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
      // Resolve tenant and franchise IDs. RLS requires franchise_id for inserts.
      const effectiveTenantId = context.tenantId || lead.tenant_id;
      const effectiveFranchiseId = context.franchiseId || lead.franchise_id;

      if (!effectiveTenantId || !effectiveFranchiseId) {
        throw new Error('Missing tenant or franchise context for conversion');
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
        const { data: oppData, error: oppError } = await supabase
          .from('opportunities')
          .insert({
            name: opportunityName || `${lead.first_name} ${lead.last_name} Opportunity`,
            account_id: accountId,
            contact_id: contactId,
            stage: 'prospecting',
            amount: lead.estimated_value,
            close_date: lead.expected_close_date,
            tenant_id: effectiveTenantId,
            franchise_id: effectiveFranchiseId,
            lead_source: lead.source,
          })
          .select()
          .single();

        if (oppError) throw oppError;
        opportunityId = oppData.id;
      }

      // Update lead with conversion info
      const { error: leadError } = await supabase
        .from('leads')
        .update({
          status: 'won',
          converted_at: new Date().toISOString(),
          converted_account_id: accountId,
          converted_contact_id: contactId,
        })
        .eq('id', lead.id);

      if (leadError) throw leadError;

      toast.success('Lead converted successfully!');
      onOpenChange(false);
      onConversionComplete();
      
      // Navigate to the created opportunity if available
      if (opportunityId) {
        navigate(`/dashboard/opportunities/${opportunityId}`);
      }
    } catch (error: any) {
      toast.error('Failed to convert lead');
      console.error('Error:', error);
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

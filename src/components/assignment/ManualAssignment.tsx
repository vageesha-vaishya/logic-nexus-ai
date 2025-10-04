import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

interface Props {
  leadId: string;
  currentOwnerId?: string | null;
  onAssigned?: () => void;
}

export function ManualAssignment({ leadId, currentOwnerId, onAssigned }: Props) {
  const { supabase, context } = useCRM();
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      // Get all active profiles
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('is_active', true);

      if (!allProfiles) return;

      // Get user capacity data
      let capacityQuery = supabase
        .from('user_capacity')
        .select('user_id, is_available, current_leads, max_leads');

      if (context.tenantId) capacityQuery = capacityQuery.eq('tenant_id', context.tenantId);

      const { data: capacities } = await capacityQuery;

      // Filter to available users with capacity
      const availableUsers = allProfiles.filter(profile => {
        const capacity = capacities?.find(c => c.user_id === profile.id);
        return !capacity || (capacity.is_available && capacity.current_leads < capacity.max_leads);
      });

      setUsers(availableUsers);
    } catch (error: any) {
      toast.error('Failed to load users');
      console.error('Error:', error);
    }
  };

  const handleAssign = async () => {
    if (!selectedUser) {
      toast.error('Please select a user');
      return;
    }

    setLoading(true);
    try {
      // Get lead details first
      const { data: lead } = await supabase
        .from('leads')
        .select('id, tenant_id, franchise_id, first_name, last_name, company, email, phone, status')
        .eq('id', leadId)
        .single();

      if (!lead) throw new Error('Lead not found');

      // Update lead owner
      const { error: updateError } = await supabase
        .from('leads')
        .update({ owner_id: selectedUser })
        .eq('id', leadId);

      if (updateError) throw updateError;

      // Record assignment history
      const { error: historyError } = await supabase
        .from('lead_assignment_history')
        .insert({
          lead_id: leadId,
          assigned_from: currentOwnerId,
          assigned_to: selectedUser,
          assignment_method: 'manual',
          reason: reason || 'Manual assignment',
          assigned_by: context.userId,
          tenant_id: lead.tenant_id,
          franchise_id: lead.franchise_id,
        });

      if (historyError) throw historyError;

      // Update capacities
      if (currentOwnerId) {
        await supabase.rpc('decrement_user_lead_count', {
          p_user_id: currentOwnerId,
          p_tenant_id: lead.tenant_id,
        });
      }

      await supabase.rpc('increment_user_lead_count', {
        p_user_id: selectedUser,
        p_tenant_id: lead.tenant_id,
      });

      // Send email notification to the assignee (best-effort)
      try {
        const { data: assignee, error: assigneeErr } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name')
          .eq('id', selectedUser)
          .single();

        if (!assigneeErr && assignee?.email) {
          // Choose active email account
          let emailQuery = supabase
            .from('email_accounts')
            .select('id, email_address, is_primary')
            .eq('is_active', true)
            .limit(1);

          if (lead.franchise_id) {
            emailQuery = emailQuery.eq('franchise_id', lead.franchise_id);
          } else if (lead.tenant_id) {
            emailQuery = emailQuery.eq('tenant_id', lead.tenant_id);
          }

          const { data: emailAccount } = await emailQuery.single();

          if (emailAccount?.id) {
            const subject = `New Lead Assigned: ${lead.first_name} ${lead.last_name}`;
            const baseUrl = import.meta.env.VITE_APP_BASE_URL || window.location.origin;
            const displayName = [assignee.first_name, assignee.last_name].filter(Boolean).join(' ');
            const bodyHtml = `
              <p>Hi ${displayName},</p>
              <p>You have been assigned a new lead:</p>
              <ul>
                <li><strong>Name:</strong> ${lead.first_name} ${lead.last_name}</li>
                ${lead.company ? `<li><strong>Company:</strong> ${lead.company}</li>` : ''}
                ${lead.email ? `<li><strong>Email:</strong> ${lead.email}</li>` : ''}
                ${lead.phone ? `<li><strong>Phone:</strong> ${lead.phone}</li>` : ''}
                <li><strong>Status:</strong> ${lead.status}</li>
              </ul>
              <p><a href="${baseUrl}/dashboard/leads/${lead.id}">View Lead</a></p>
            `;

            await supabase.functions.invoke('send-email', {
              body: {
                accountId: emailAccount.id,
                to: [assignee.email],
                cc: [],
                subject,
                body: bodyHtml,
              },
            });
          }
        }
      } catch (notifyErr) {
        console.warn('Assignment email skipped:', (notifyErr as any)?.message || notifyErr);
      }

      toast.success('Lead assigned successfully');
      onAssigned?.();
    } catch (error: any) {
      toast.error('Failed to assign lead');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="user">Assign To</Label>
        <Select value={selectedUser} onValueChange={setSelectedUser}>
          <SelectTrigger>
            <SelectValue placeholder="Select user" />
          </SelectTrigger>
          <SelectContent>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.first_name} {user.last_name} ({user.email})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reason">Reason (Optional)</Label>
        <Textarea
          id="reason"
          placeholder="Why are you assigning this lead?"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
        />
      </div>

      <Button onClick={handleAssign} disabled={loading || !selectedUser} className="w-full">
        {loading ? 'Assigning...' : 'Assign Lead'}
      </Button>
    </div>
  );
}

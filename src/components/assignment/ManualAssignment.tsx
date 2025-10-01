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
        .select('tenant_id, franchise_id')
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

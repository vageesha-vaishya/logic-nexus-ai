import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export interface Queue {
  queue_id: string;
  queue_name: string;
  queue_type: string;
  description: string | null;
  email_count: number;
  unread_count: number;
}

export interface QueueRule {
  id: string;
  tenant_id: string;
  queue_id: string;
  name: string;
  description: string | null;
  criteria: QueueRuleCriteria;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  queue?: { name: string };
}

export interface QueueRuleCriteria {
  subject_contains?: string;
  from_email?: string;
  from_domain?: string;
  body_contains?: string;
  channel?: 'email' | 'whatsapp' | 'x' | 'telegram' | 'linkedin' | 'web' | 'sms' | 'voice' | 'other';
  priority?: string;
  ai_category?: string;
  ai_sentiment?: string;
  ai_intent?: string;
  // New fields for multi-layered classification
  header_contains?: Record<string, string>;
  metadata_flags?: string[];
  keywords?: string[];
  whitelist_check?: boolean;
  blacklist_check?: boolean;
}

export function useQueueManagement() {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [rules, setRules] = useState<QueueRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [rulesLoading, setRulesLoading] = useState(false);
  const { toast } = useToast();
  const { roles } = useAuth();

  const getTenantId = useCallback(() => {
    const tenantAdmin = roles.find((r) => r.role === 'tenant_admin' && r.tenant_id);
    return tenantAdmin?.tenant_id || roles.find((r) => r.tenant_id)?.tenant_id || null;
  }, [roles]);

  const fetchQueues = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_user_queues');
      
      if (error) throw error;
      
      setQueues((data as Queue[]) || []);
    } catch (error: any) {
      console.error('Error fetching queues:', error);
      toast({
        title: 'Error',
        description: 'Failed to load queues',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchRules = useCallback(async () => {
    const tenantId = getTenantId();
    if (!tenantId) return;

    try {
      setRulesLoading(true);
      const { data, error } = await supabase
        .from('queue_rules')
        .select('*, queue:queues(name)')
        .eq('tenant_id', tenantId)
        .order('priority', { ascending: false });

      if (error) throw error;
      
      // Type-safe mapping of the data
      const mappedRules: QueueRule[] = (data || []).map((rule: any) => ({
        id: rule.id,
        tenant_id: rule.tenant_id,
        queue_id: rule.queue_id,
        name: rule.name,
        description: rule.description,
        criteria: rule.criteria as QueueRuleCriteria,
        priority: rule.priority,
        is_active: rule.is_active,
        created_at: rule.created_at,
        updated_at: rule.updated_at,
        queue: rule.queue,
      }));
      
      setRules(mappedRules);
    } catch (error: any) {
      console.error('Error fetching queue rules:', error);
      toast({
        title: 'Error',
        description: 'Failed to load queue rules',
        variant: 'destructive',
      });
    } finally {
      setRulesLoading(false);
    }
  }, [getTenantId, toast]);

  const assignEmailToQueue = useCallback(async (emailId: string, queueName: string) => {
    try {
      // Use direct update instead of RPC since function may not be in types
      const tenantId = getTenantId();
      if (!tenantId) throw new Error('No tenant context');

      const { error } = await supabase
        .from('emails')
        .update({ queue: queueName, updated_at: new Date().toISOString() })
        .eq('id', emailId)
        .eq('tenant_id', tenantId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Email assigned to ${queueName}`,
      });

      return true;
    } catch (error: any) {
      console.error('Error assigning email to queue:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to assign email to queue',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast, getTenantId]);

  const createRule = useCallback(async (rule: Omit<QueueRule, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      // Build insert payload matching actual table schema
      const insertPayload: Record<string, unknown> = {
        tenant_id: rule.tenant_id,
        name: rule.name,
        description: rule.description,
        criteria: JSON.parse(JSON.stringify(rule.criteria)),
        priority: rule.priority,
        is_active: rule.is_active,
      };
      
      // The table has queue_id column (UUID)
      if (rule.queue_id) {
        insertPayload.queue_id = rule.queue_id;
      }

      const { data, error } = await supabase
        .from('queue_rules')
        .insert([insertPayload as any])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Queue rule created',
      });

      await fetchRules();
      return data;
    } catch (error: any) {
      console.error('Error creating queue rule:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create queue rule',
        variant: 'destructive',
      });
      return null;
    }
  }, [fetchRules, toast]);

  const updateRule = useCallback(async (ruleId: string, updates: Partial<QueueRule>) => {
    try {
      const { criteria, ...rest } = updates;
      const updatePayload: Record<string, any> = { ...rest };
      if (criteria !== undefined) {
        updatePayload.criteria = criteria;
      }

      const { error } = await supabase
        .from('queue_rules')
        .update(updatePayload)
        .eq('id', ruleId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Queue rule updated',
      });

      await fetchRules();
      return true;
    } catch (error: any) {
      console.error('Error updating queue rule:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update queue rule',
        variant: 'destructive',
      });
      return false;
    }
  }, [fetchRules, toast]);

  const deleteRule = useCallback(async (ruleId: string) => {
    try {
      const { error } = await supabase
        .from('queue_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Queue rule deleted',
      });

      await fetchRules();
      return true;
    } catch (error: any) {
      console.error('Error deleting queue rule:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete queue rule',
        variant: 'destructive',
      });
      return false;
    }
  }, [fetchRules, toast]);

  const getQueueCounts = useCallback(() => {
    const counts: Record<string, number> = {};
    queues.forEach((q) => {
      counts[q.queue_name] = q.email_count;
    });
    return counts;
  }, [queues]);

  const getUnreadCounts = useCallback(() => {
    const counts: Record<string, number> = {};
    queues.forEach((q) => {
      counts[q.queue_name] = q.unread_count;
    });
    return counts;
  }, [queues]);

  useEffect(() => {
    fetchQueues();
    fetchRules();
  }, [fetchQueues, fetchRules]);

  return {
    queues,
    rules,
    loading,
    rulesLoading,
    fetchQueues,
    fetchRules,
    assignEmailToQueue,
    createRule,
    updateRule,
    deleteRule,
    getQueueCounts,
    getUnreadCounts,
    getTenantId,
  };
}

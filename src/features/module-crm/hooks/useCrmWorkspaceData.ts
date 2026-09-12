import { useEffect, useMemo, useState } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { useAssignableUsers, type AssignableUser } from '@/hooks/useAssignableUsers';
import { logger } from '@/lib/logger';
import type { Task } from '@/components/crm/TaskScheduler';

export interface WorkspaceLead {
  id: string;
  first_name: string;
  last_name: string;
  company: string | null;
  status: string | null;
  source: string | null;
  lead_score: number | null;
  estimated_value: number | null;
  owner_id: string | null;
  updated_at: string | null;
  title: string | null;
}

interface WorkspaceActivity {
  id: string;
  subject: string | null;
  activity_type: string | null;
  due_date: string | null;
  status: string | null;
  priority: string | null;
  assigned_to: string | null;
  lead_id: string | null;
}

function deriveTaskStatus(activity: WorkspaceActivity): Task['status'] {
  if (activity.status === 'completed') return 'completed';
  if (activity.due_date && new Date(activity.due_date).getTime() < Date.now()) return 'overdue';
  return 'pending';
}

function derivePriority(value: string | null): Task['priority'] {
  return value === 'high' || value === 'medium' || value === 'low' ? value : 'medium';
}

export function useCrmWorkspaceData() {
  const { scopedDb, contextReady } = useCRM();
  const { fetchAssignableUsers } = useAssignableUsers();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [leads, setLeads] = useState<WorkspaceLead[]>([]);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [activities, setActivities] = useState<WorkspaceActivity[]>([]);

  useEffect(() => {
    if (!contextReady) return;

    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [leadsResult, usersResult, activitiesResult] = await Promise.all([
          scopedDb
            .from('leads')
            .select('id, first_name, last_name, company, status, source, lead_score, estimated_value, owner_id, updated_at, title')
            .order('updated_at', { ascending: false })
            .limit(50),
          fetchAssignableUsers({ limit: 50 }),
          scopedDb
            .from('activities')
            .select('id, subject, activity_type, due_date, status, priority, assigned_to, lead_id')
            .order('due_date', { ascending: true })
            .limit(20),
        ]);

        if (cancelled) return;

        if (leadsResult.error) throw new Error(`Failed to fetch leads: ${leadsResult.error.message}`);
        if (activitiesResult.error) throw new Error(`Failed to fetch activities: ${activitiesResult.error.message}`);
        if (usersResult.error) throw new Error(`Failed to fetch users: ${usersResult.error.message}`);

        setLeads((leadsResult.data as WorkspaceLead[]) || []);
        setUsers((usersResult.data as AssignableUser[]) || []);
        setActivities((activitiesResult.data as WorkspaceActivity[]) || []);
      } catch (err: any) {
        logger.error('[useCrmWorkspaceData] fetch failed', err);
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [contextReady, scopedDb, fetchAssignableUsers]);

  const usersById = useMemo(() => {
    const map = new Map<string, AssignableUser>();
    users.forEach((u) => map.set(u.id, u));
    return map;
  }, [users]);

  const leadsById = useMemo(() => {
    const map = new Map<string, WorkspaceLead>();
    leads.forEach((l) => map.set(l.id, l));
    return map;
  }, [leads]);

  const tasks: Task[] = useMemo(
    () =>
      activities.map((activity) => {
        const assignee = activity.assigned_to ? usersById.get(activity.assigned_to) : undefined;
        const assigneeName = assignee ? [assignee.first_name, assignee.last_name].filter(Boolean).join(' ') || assignee.email || 'Unassigned' : 'Unassigned';
        const relatedLead = activity.lead_id ? leadsById.get(activity.lead_id) : undefined;
        return {
          id: activity.id,
          title: activity.subject || activity.activity_type || 'Task',
          due_date: activity.due_date || new Date().toISOString(),
          status: deriveTaskStatus(activity),
          priority: derivePriority(activity.priority),
          assigned_to: { name: assigneeName, avatar: assignee?.avatar_url || undefined },
          related_to: relatedLead
            ? { type: 'lead', id: relatedLead.id, name: `${relatedLead.first_name} ${relatedLead.last_name}`.trim() }
            : undefined,
        };
      }),
    [activities, usersById, leadsById]
  );

  return { loading, error, leads, users, tasks };
}

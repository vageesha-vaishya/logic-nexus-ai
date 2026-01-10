import { useState, useEffect, useMemo } from 'react';
import { useCRM } from './useCRM';
import { ScopedDataAccess, DataAccessContext } from '@/lib/db/access';
import { useAssignableUsers } from './useAssignableUsers';

export interface LeadItem {
  id: string;
  first_name: string;
  last_name: string;
  company: string | null;
  status: string;
  owner_id: string | null;
}

export interface ActivityItem {
  id: string;
  activity_type: string;
  subject: string | null;
  due_date: string | null;
  status: string | null;
  assigned_to: string | null;
  lead_id: string | null;
}

export function useDashboardData() {
  const { supabase, context } = useCRM();
  const { fetchAssignableUsers } = useAssignableUsers();
  
  const [loading, setLoading] = useState(true);
  const [myLeads, setMyLeads] = useState<LeadItem[]>([]);
  const [myActivities, setMyActivities] = useState<ActivityItem[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<any[]>([]);
  const [leadNamesById, setLeadNamesById] = useState<Record<string, string>>({});
  const [error, setError] = useState<Error | null>(null);

  const dao = useMemo(() => new ScopedDataAccess(supabase, context as unknown as DataAccessContext), [supabase, context]);

  useEffect(() => {
    const fetchData = async () => {
      // If we don't have a user ID yet, we can't fetch personalized data
      if (!context?.userId) {
        return;
      }

      setLoading(true);
      setError(null);
      
      try {
        // Parallel fetching
        const [usersResult, leadsResult, activitiesResult] = await Promise.all([
          fetchAssignableUsers({ search: '', limit: 50 }),
          
          dao.from('leads')
            .select('id, first_name, last_name, company, status, owner_id')
            .eq('owner_id', context.userId)
            .order('created_at', { ascending: false })
            .limit(6),
            
          dao.from('activities')
            .select('id, activity_type, subject, due_date, status, assigned_to, lead_id')
            .eq('assigned_to', context.userId)
            .or('status.is.null,status.neq.completed')
            .order('due_date', { ascending: true })
            .limit(6)
        ]);

        if (leadsResult.error) {
          console.error('Leads fetch error:', leadsResult.error);
          throw new Error(`Failed to fetch leads: ${leadsResult.error.message}`);
        }
        if (activitiesResult.error) {
          console.error('Activities fetch error:', activitiesResult.error);
          throw new Error(`Failed to fetch activities: ${activitiesResult.error.message}`);
        }

        const leads = (leadsResult.data as LeadItem[]) || [];
        const activities = (activitiesResult.data as ActivityItem[]) || [];
        const users = (usersResult.data as any[]) || [];
        
        setMyLeads(leads);
        setMyActivities(activities);
        setAssignableUsers(users);

        // Fetch referenced lead names
        const leadIds = Array.from(new Set(activities.map(a => a.lead_id).filter(Boolean))) as string[];
        
        if (leadIds.length > 0) {
          const { data: leadRefs, error: leadRefsErr } = await dao
            .from('leads')
            .select('id, first_name, last_name, company')
            .in('id', leadIds);

          if (leadRefsErr) {
             console.error('Lead refs fetch error:', leadRefsErr);
             // Non-fatal error, just log it
          } else {
            const map: Record<string, string> = {};
            for (const l of (leadRefs as any[])) {
              const fullName = [l.first_name, l.last_name].filter(Boolean).join(' ').trim();
              map[l.id] = fullName || l.company || 'Lead';
            }
            setLeadNamesById(map);
          }
        } else {
          setLeadNamesById({});
        }

      } catch (err: any) {
        console.error('Dashboard fetch error:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [context.userId, dao, fetchAssignableUsers]);

  return { 
    loading, 
    myLeads, 
    myActivities, 
    assignableUsers, 
    leadNamesById, 
    setMyActivities,
    error 
  };
}


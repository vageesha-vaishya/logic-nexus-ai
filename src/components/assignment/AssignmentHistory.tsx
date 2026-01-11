import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ArrowRight, Search } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { format } from 'date-fns';

export function AssignmentHistory() {
  const { supabase, context } = useCRM();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        // Use ScopedDataAccess for proper tenant/franchise filtering
        const { data: historyData, error } = await scopedDb
          .from('lead_assignment_history')
          .select('*')
          .order('assigned_at', { ascending: false })
          .limit(100);

        if (error) throw error;

        // Fetch related data separately using scopedDb for proper scoping
        if (historyData && historyData.length > 0) {
          const leadIds = (historyData as any[]).map(h => h.lead_id).filter(Boolean);
          const userIds = [...new Set([
            ...(historyData as any[]).map(h => h.assigned_to),
            ...(historyData as any[]).map(h => h.assigned_from).filter(Boolean)
          ])];

          const [{ data: leadsData }, { data: profilesData }] = await Promise.all([
            scopedDb.from('leads').select('id, first_name, last_name, company').in('id', leadIds),
            scopedDb.from('profiles').select('id, first_name, last_name').in('id', userIds)
          ]);

          const leadsMap = new Map((leadsData as any[])?.map(l => [l.id, l]));
          const profilesMap = new Map(profilesData?.map(p => [p.id, p]));

          const enrichedData = (historyData as any[]).map(item => ({
            ...item,
            leads: leadsMap.get(item.lead_id),
            assigned_to_profile: profilesMap.get(item.assigned_to),
            assigned_from_profile: item.assigned_from ? profilesMap.get(item.assigned_from) : null
          }));

          setHistory(enrichedData);
        } else {
          setHistory([]);
        }
      } catch (error: any) {
        toast.error('Failed to load history');
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
    // Include context._version to trigger re-fetch when scope changes
  }, [scopedDb, context.tenantId, context.franchiseId, context._version]);

  const filteredHistory = history.filter((item) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      item.leads?.first_name?.toLowerCase().includes(searchLower) ||
      item.leads?.last_name?.toLowerCase().includes(searchLower) ||
      item.leads?.company?.toLowerCase().includes(searchLower) ||
      item.assigned_to_profile?.first_name?.toLowerCase().includes(searchLower) ||
      item.assigned_to_profile?.last_name?.toLowerCase().includes(searchLower)
    );
  });

  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      manual: 'bg-blue-500/10 text-blue-500',
      round_robin: 'bg-purple-500/10 text-purple-500',
      rule_based: 'bg-green-500/10 text-green-500',
      territory: 'bg-yellow-500/10 text-yellow-500',
    };
    return colors[method] || 'bg-gray-500/10 text-gray-500';
  };

  if (loading) {
    return <div className="text-center py-12">Loading history...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Assignment History</h3>
        <p className="text-sm text-muted-foreground">
          Track all lead assignment changes and history
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by lead or user..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredHistory.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {searchQuery ? 'No matching assignments found' : 'No assignment history'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredHistory.map((item) => (
            <Card key={item.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">
                          {item.leads?.first_name} {item.leads?.last_name}
                        </h4>
                        {item.leads?.company && (
                          <span className="text-sm text-muted-foreground">
                            · {item.leads.company}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm">
                        {item.assigned_from_profile && (
                          <>
                            <span className="text-muted-foreground">
                              {item.assigned_from_profile.first_name}{' '}
                              {item.assigned_from_profile.last_name}
                            </span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          </>
                        )}
                        <span className="font-medium">
                          {item.assigned_to_profile?.first_name}{' '}
                          {item.assigned_to_profile?.last_name}
                        </span>
                      </div>

                      {item.reason && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.reason}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <Badge className={getMethodColor(item.assignment_method)}>
                        {item.assignment_method.replace('_', ' ')}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(item.assigned_at), 'MMM d, yyyy HH:mm')}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

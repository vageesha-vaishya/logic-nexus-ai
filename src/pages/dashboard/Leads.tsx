import { useState, useEffect } from 'react';
import { Plus, Search, UserPlus, DollarSign, Calendar, Filter, TrendingUp, Upload, Users as UsersIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ViewToggle, ViewMode } from '@/components/ui/view-toggle';
import { useCRM } from '@/hooks/useCRM';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  source: string;
  estimated_value: number | null;
  created_at: string;
  lead_score: number | null;
  qualification_status: string | null;
  owner_id?: string | null;
}

export default function Leads() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [scoreFilter, setScoreFilter] = useState<string>('all');
  const [ownerFilter, setOwnerFilter] = useState<'any' | 'unassigned' | 'me'>('any');
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const { supabase, context } = useCRM();

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error: any) {
      toast.error('Failed to load leads');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = `${lead.first_name} ${lead.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.company?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    
    const matchesScore = scoreFilter === 'all' || 
      (scoreFilter === 'high' && (lead.lead_score || 0) >= 70) ||
      (scoreFilter === 'medium' && (lead.lead_score || 0) >= 40 && (lead.lead_score || 0) < 70) ||
      (scoreFilter === 'low' && (lead.lead_score || 0) < 40);
    
    const matchesOwner =
      ownerFilter === 'any'
        ? true
        : ownerFilter === 'unassigned'
        ? !lead.owner_id
        : lead.owner_id === (context?.userId || null);

    return matchesSearch && matchesStatus && matchesScore && matchesOwner;
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: 'bg-blue-500/10 text-blue-500',
      contacted: 'bg-purple-500/10 text-purple-500',
      qualified: 'bg-teal-500/10 text-teal-500',
      proposal: 'bg-yellow-500/10 text-yellow-500',
      negotiation: 'bg-orange-500/10 text-orange-500',
      won: 'bg-green-500/10 text-green-500',
      lost: 'bg-red-500/10 text-red-500',
    };
    return colors[status] || 'bg-gray-500/10 text-gray-500';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Leads</h1>
          <p className="text-muted-foreground">Track and convert potential customers</p>
        </div>
        <div className="flex gap-2 items-center">
          <ViewToggle value={viewMode} onChange={setViewMode} />
          <Button variant="outline" onClick={() => navigate('/dashboard/lead-assignment')}>
            <UsersIcon className="mr-2 h-4 w-4" />
            Lead Assignment
          </Button>
          <Button variant="outline" onClick={() => navigate('/dashboard/leads/import-export')}>
            <Upload className="mr-2 h-4 w-4" />
            Import / Export
          </Button>
          <Button asChild>
            <Link to="/dashboard/leads/new">
              <Plus className="mr-2 h-4 w-4" />
              New Lead
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="qualified">Qualified</SelectItem>
            <SelectItem value="proposal">Proposal</SelectItem>
            <SelectItem value="negotiation">Negotiation</SelectItem>
            <SelectItem value="won">Won</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
          </SelectContent>
        </Select>

        <Select value={scoreFilter} onValueChange={setScoreFilter}>
          <SelectTrigger className="w-[180px]">
            <TrendingUp className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Score" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Scores</SelectItem>
            <SelectItem value="high">High (70+)</SelectItem>
            <SelectItem value="medium">Medium (40-69)</SelectItem>
            <SelectItem value="low">Low (&lt;40)</SelectItem>
          </SelectContent>
        </Select>

        <Select value={ownerFilter} onValueChange={(v) => setOwnerFilter(v as any)}>
          <SelectTrigger className="w-[180px]">
            <UsersIcon className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Owner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any Owner</SelectItem>
            <SelectItem value="me">Assigned to Me</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading leads...</p>
        </div>
      ) : filteredLeads.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <UserPlus className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No leads found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? 'Try adjusting your search' : 'Start building your sales pipeline'}
            </p>
            {!searchQuery && (
              <Button asChild>
                <Link to="/dashboard/leads/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Lead
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredLeads.map((lead) => (
            <Link key={lead.id} to={`/dashboard/leads/${lead.id}`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <UserPlus className="h-10 w-10 text-primary" />
                    <Badge className={getStatusColor(lead.status)}>
                      {lead.status}
                    </Badge>
                  </div>
                  <CardTitle className="mt-4">
                    {lead.first_name} {lead.last_name}
                  </CardTitle>
                  {lead.company && (
                    <CardDescription>{lead.company}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    {lead.estimated_value && (
                      <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                        <DollarSign className="h-4 w-4" />
                        <span>${lead.estimated_value.toLocaleString()}</span>
                      </div>
                    )}
                    {lead.lead_score !== null && (
                      <div className="flex items-center gap-1 text-sm font-medium">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        <span>{lead.lead_score}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="outline" className="text-xs">
                      {lead.source}
                    </Badge>
                    {lead.qualification_status && (
                      <Badge variant="outline" className="text-xs">
                        {lead.qualification_status}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
    </DashboardLayout>
  );
}

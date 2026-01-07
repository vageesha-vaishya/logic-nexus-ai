import { useState, useEffect } from 'react';
import { Plus, Search, UserPlus, DollarSign, Calendar, Filter, TrendingUp, Upload, Users as UsersIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import TitleStrip from '@/components/ui/title-strip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ViewToggle, ViewMode } from '@/components/ui/view-toggle';
import { useCRM } from '@/hooks/useCRM';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { matchText, TextOp } from '@/lib/utils';
import { ScopedDataAccess } from '@/lib/db/access';

import { Lead, LeadStatus, stages, statusConfig } from './leads-data';

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

  // Advanced per-column filters
  const [nameQuery, setNameQuery] = useState('');
  const [nameOp, setNameOp] = useState<TextOp>('contains');
  const [companyQuery, setCompanyQuery] = useState('');
  const [companyOp, setCompanyOp] = useState<TextOp>('contains');
  const [emailQuery, setEmailQuery] = useState('');
  const [emailOp, setEmailOp] = useState<TextOp>('contains');
  const [phoneQuery, setPhoneQuery] = useState('');
  const [phoneOp, setPhoneOp] = useState<TextOp>('contains');
  const [sourceQuery, setSourceQuery] = useState('');
  const [sourceOp, setSourceOp] = useState<TextOp>('contains');
  const [qualificationQuery, setQualificationQuery] = useState('');
  const [qualificationOp, setQualificationOp] = useState<TextOp>('contains');
  const [scoreMin, setScoreMin] = useState<string>('');
  const [scoreMax, setScoreMax] = useState<string>('');
  const [valueMin, setValueMin] = useState<string>('');
  const [valueMax, setValueMax] = useState<string>('');
  const [createdStart, setCreatedStart] = useState<string>('');
  const [createdEnd, setCreatedEnd] = useState<string>('');

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const dao = new ScopedDataAccess(supabase, context);
      const { data, error } = await dao
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      // Validate and cast data
      const safeLeads = (data || []).map(d => ({
        ...d,
        status: stages.includes(d.status as LeadStatus) ? (d.status as LeadStatus) : 'new'
      })) as Lead[];

      setLeads(safeLeads);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to load leads');
      console.error('Error:', message);
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

    // Advanced per-column text filters
    const fullName = `${lead.first_name} ${lead.last_name}`.trim();
    const matchesName = matchText(fullName, nameQuery, nameOp);
    const matchesCompany = matchText(lead.company ?? '', companyQuery, companyOp);
    const matchesEmail = matchText(lead.email ?? '', emailQuery, emailOp);
    const matchesPhone = matchText(lead.phone ?? '', phoneQuery, phoneOp);
    const matchesSource = matchText(lead.source ?? '', sourceQuery, sourceOp);
    const matchesQualification = matchText(lead.qualification_status ?? '', qualificationQuery, qualificationOp);

    // Numeric ranges (inclusive)
    const scoreVal = lead.lead_score ?? undefined;
    const sMin = scoreMin ? Number(scoreMin) : undefined;
    const sMax = scoreMax ? Number(scoreMax) : undefined;
    const matchesScoreRange = (
      (sMin === undefined || (scoreVal !== undefined && scoreVal >= sMin)) &&
      (sMax === undefined || (scoreVal !== undefined && scoreVal <= sMax))
    );

    const valueVal = lead.estimated_value ?? undefined;
    const vMin = valueMin ? Number(valueMin) : undefined;
    const vMax = valueMax ? Number(valueMax) : undefined;
    const matchesValueRange = (
      (vMin === undefined || (valueVal !== undefined && valueVal >= vMin)) &&
      (vMax === undefined || (valueVal !== undefined && valueVal <= vMax))
    );

    // Date range (created_at)
    const created = lead.created_at ? new Date(lead.created_at) : null;
    const cStart = createdStart ? new Date(createdStart) : null;
    const cEnd = createdEnd ? new Date(createdEnd) : null;
    const matchesCreatedRange = (
      (!cStart || (created && created >= cStart)) &&
      (!cEnd || (created && created <= cEnd))
    );

    return (
      matchesSearch &&
      matchesStatus &&
      matchesScore &&
      matchesOwner &&
      matchesName &&
      matchesCompany &&
      matchesEmail &&
      matchesPhone &&
      matchesSource &&
      matchesQualification &&
      matchesScoreRange &&
      matchesValueRange &&
      matchesCreatedRange
    );
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
          <ViewToggle
            value={viewMode}
            modes={['pipeline','card','grid','list']}
            onChange={(v) => v === 'pipeline' ? navigate('/dashboard/leads/pipeline') : setViewMode(v)}
          />
          {/* Removed standalone Pipeline View button; use ViewToggle with Pipeline first */}
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

      {/* Advanced per-column filters */}
      <div className="flex flex-wrap gap-3 mb-2">
        <div className="flex items-center gap-2">
          <Select value={nameOp} onValueChange={(v) => setNameOp(v as TextOp)}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Name op" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="contains">Contains</SelectItem>
              <SelectItem value="equals">Equals</SelectItem>
              <SelectItem value="startsWith">Starts With</SelectItem>
              <SelectItem value="endsWith">Ends With</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Name"
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
            className="w-[180px]"
          />
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

        <Select value={ownerFilter} onValueChange={(v) => setOwnerFilter(v as 'any' | 'unassigned' | 'me')}>
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

      <div className="flex flex-wrap gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="Score min"
            value={scoreMin}
            onChange={(e) => setScoreMin(e.target.value)}
            className="w-[130px]"
          />
          <Input
            type="number"
            placeholder="Score max"
            value={scoreMax}
            onChange={(e) => setScoreMax(e.target.value)}
            className="w-[130px]"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="Value min"
            value={valueMin}
            onChange={(e) => setValueMin(e.target.value)}
            className="w-[140px]"
          />
          <Input
            type="number"
            placeholder="Value max"
            value={valueMax}
            onChange={(e) => setValueMax(e.target.value)}
            className="w-[140px]"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Input
            type="date"
            placeholder="Created from"
            value={createdStart}
            onChange={(e) => setCreatedStart(e.target.value)}
            className="w-[170px]"
          />
          <Input
            type="date"
            placeholder="Created to"
            value={createdEnd}
            onChange={(e) => setCreatedEnd(e.target.value)}
            className="w-[170px]"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-2">
        <div className="flex items-center gap-2">
          <Select value={companyOp} onValueChange={(v) => setCompanyOp(v as TextOp)}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Company op" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="contains">Contains</SelectItem>
              <SelectItem value="equals">Equals</SelectItem>
              <SelectItem value="startsWith">Starts With</SelectItem>
              <SelectItem value="endsWith">Ends With</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Company"
            value={companyQuery}
            onChange={(e) => setCompanyQuery(e.target.value)}
            className="w-[180px]"
          />
        </div>

        <div className="flex items-center gap-2">
          <Select value={emailOp} onValueChange={(v) => setEmailOp(v as TextOp)}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Email op" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="contains">Contains</SelectItem>
              <SelectItem value="equals">Equals</SelectItem>
              <SelectItem value="startsWith">Starts With</SelectItem>
              <SelectItem value="endsWith">Ends With</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Email"
            value={emailQuery}
            onChange={(e) => setEmailQuery(e.target.value)}
            className="w-[200px]"
          />
        </div>
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
      ) : viewMode === 'list' ? (
        <Card>
          <CardHeader className="pb-2">
            <TitleStrip label="All Leads" />
          </CardHeader>
              <Table>
                <TableHeader className="bg-[hsl(var(--title-strip))] [&_th]:text-white [&_th]:font-semibold [&_th]:text-xs [&_th]:px-3 [&_th]:py-2 [&_th]:border-l [&_th]:border-white/60">
                  <TableRow className="border-b-2" style={{ borderBottomColor: 'hsl(var(--title-strip))' }}>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
            <TableBody>
              {filteredLeads.map((lead) => (
                <TableRow 
                  key={lead.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/dashboard/leads/${lead.id}`)}
                >
                  <TableCell className="font-medium">
                    {lead.first_name} {lead.last_name}
                  </TableCell>
                  <TableCell>{lead.company || '-'}</TableCell>
                  <TableCell>{lead.email || '-'}</TableCell>
                  <TableCell>{lead.phone || '-'}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(lead.status)}>
                      {lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{lead.source}</Badge>
                  </TableCell>
                  <TableCell>
                    {lead.lead_score !== null ? (
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        {lead.lead_score}
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    {lead.estimated_value ? (
                      <div className="flex items-center gap-1 text-green-600">
                        <DollarSign className="h-4 w-4" />
                        ${lead.estimated_value.toLocaleString()}
                      </div>
                    ) : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="space-y-2">
          <TitleStrip label="All Leads" />
          <div className={viewMode === 'grid' ? 'grid gap-4 md:grid-cols-2 lg:grid-cols-4' : 'grid gap-4 md:grid-cols-2 lg:grid-cols-3'}>
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
        </div>
      )}
    </div>
    </DashboardLayout>
  );
}

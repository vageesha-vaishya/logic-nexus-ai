import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FirstScreenTemplate } from '@/components/system/FirstScreenTemplate';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { KanbanBoard, ColumnType } from '@/components/kanban/KanbanBoard';
import { KanbanItem } from '@/components/kanban/KanbanCard';
import { CustomerSegmentation } from '@/components/crm/CustomerSegmentation';
import { TaskScheduler, Task } from '@/components/crm/TaskScheduler';
import { mockLeads, mockUsers } from '../mock-data';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { THEME_PRESETS } from '@/theme/themes';
import { themeStyleFromPreset } from '@/lib/theme-utils';

export type ThemeTokens = {
  primary?: string;
  accent?: string;
  start?: string;
  end?: string;
  angle?: number;
  radius?: string;
  background?: string;
};


const columns: ColumnType[] = [
  { id: 'new', title: 'New', color: 'bg-blue-500/10 text-blue-700' },
  { id: 'contacted', title: 'Contacted', color: 'bg-purple-500/10 text-purple-700' },
  { id: 'negotiation', title: 'Negotiation', color: 'bg-orange-500/10 text-orange-700' },
  { id: 'won', title: 'Won', color: 'bg-green-500/10 text-green-700' },
  { id: 'lost', title: 'Lost', color: 'bg-red-500/10 text-red-700' },
];

const kanbanItems: KanbanItem[] = mockLeads.map(lead => ({
  id: lead.id,
  title: `${lead.first_name} ${lead.last_name}`,
  subtitle: lead.company || undefined,
  status: lead.status,
  priority: (lead.lead_score && lead.lead_score > 80) ? 'high' : (lead.lead_score && lead.lead_score > 50) ? 'medium' : 'low',
  value: lead.estimated_value || undefined,
  currency: 'USD',
  tags: [lead.source],
  assignee: lead.owner_id ? {
    name: mockUsers.find(u => u.id === lead.owner_id)?.name ?? 'Unassigned',
    avatarUrl: `https://i.pravatar.cc/150?u=${lead.owner_id}`
  } : undefined,
  updatedAt: lead.updated_at
}));

const segments = mockLeads.map((l, i) => ({
  id: `seg-${i}`,
  name: l.company || `${l.first_name} ${l.last_name}`,
  size: Math.max(10, l.lead_score || 10),
  demographic: { industry: l.company?.includes('Logistics') ? 'Logistics' : 'Other', title: l.title || 'Unknown', company_size: l.company?.includes('Global') ? '500-1000' : '1-100' },
  geographic: { region: 'North America' },
}));

const tasks: Task[] = [
  {
    id: 't1',
    title: 'Follow up with Acme Logistics',
    due_date: format(new Date(), "yyyy-MM-dd'T'HH:mm:ssxxx"),
    status: 'pending',
    priority: 'high',
    assigned_to: { name: mockUsers[0].name, avatar: mockUsers[0].avatar },
    related_to: { type: 'lead', id: mockLeads[0].id, name: `${mockLeads[0].first_name} ${mockLeads[0].last_name}` },
  },
  {
    id: 't2',
    title: 'Prepare proposal for Global Trade',
    due_date: format(new Date(Date.now() + 24 * 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm:ssxxx"),
    status: 'pending',
    priority: 'medium',
    assigned_to: { name: mockUsers[1].name, avatar: mockUsers[1].avatar },
    related_to: { type: 'opportunity', id: 'opp-1', name: 'Global Trade RFP' },
  },
  {
    id: 't3',
    title: 'Review contract terms',
    due_date: format(new Date(Date.now() - 48 * 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm:ssxxx"),
    status: 'overdue',
    priority: 'low',
    assigned_to: { name: mockUsers[2].name, avatar: mockUsers[2].avatar },
  },
  {
    id: 't4',
    title: 'Send onboarding email',
    due_date: format(new Date(), "yyyy-MM-dd'T'HH:mm:ssxxx"),
    status: 'completed',
    priority: 'low',
    assigned_to: { name: mockUsers[0].name, avatar: mockUsers[0].avatar },
  },
];

export function DashboardOverview({ className }: { className?: string }) {
  const stats = useMemo(() => {
    const totalLeads = mockLeads.length;
    const won = mockLeads.filter(l => l.status === 'won').length;
    const contacted = mockLeads.filter(l => l.status === 'contacted').length;
    const highScore = mockLeads.filter(l => (l.lead_score || 0) >= 80).length;
    return [
      { label: 'Total Leads', value: totalLeads, tone: 'bg-sky-500/10 text-sky-700' },
      { label: 'Won Deals', value: won, tone: 'bg-emerald-500/10 text-emerald-700' },
      { label: 'Contacted', value: contacted, tone: 'bg-violet-500/10 text-violet-700' },
      { label: 'High Score', value: highScore, tone: 'bg-amber-500/10 text-amber-700' },
    ];
  }, []);

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4", className)}>
      {stats.map((s) => (
        <Card key={s.label} className="transition-colors">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">{s.label}</CardDescription>
            <CardTitle className="text-2xl">{s.value}</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className={s.tone}>{s.label}</Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ContactsSection({ className }: { className?: string }) {
  return (
    <Card className={cn("h-full", className)}>
      <CardHeader>
        <CardTitle>Contacts</CardTitle>
        <CardDescription>Key people related to active leads</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Owner</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockLeads.map(l => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.first_name} {l.last_name}</TableCell>
                  <TableCell>{l.company}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{l.status}</Badge>
                  </TableCell>
                  <TableCell>{mockUsers.find(u => u.id === l.owner_id)?.name || 'Unassigned'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export function PipelineSection({ className }: { className?: string }) {
  return (
    <Card className={cn("h-full", className)}>
      <CardHeader>
        <CardTitle>Pipeline</CardTitle>
        <CardDescription>Drag and drop across stages</CardDescription>
      </CardHeader>
      <CardContent>
        <KanbanBoard 
          items={kanbanItems} 
          columns={columns} 
          onDragEnd={() => {}} 
        />
      </CardContent>
    </Card>
  );
}

export function AnalyticsSection({ className }: { className?: string }) {
  return (
    <Card className={cn("h-full", className)}>
      <CardHeader>
        <CardTitle>Analytics</CardTitle>
        <CardDescription>Segment distribution and breakdown</CardDescription>
      </CardHeader>
      <CardContent>
        <CustomerSegmentation segments={segments} />
      </CardContent>
    </Card>
  );
}

export function TasksSection({ className }: { className?: string }) {
  return (
    <TaskScheduler 
      tasks={tasks}
      onAddTask={() => {}}
      onCompleteTask={() => {}}
      className={cn(className)}
    />
  );
}

export function PrototypeLayout({ themeClass, themePreset }: { themeClass?: string; themePreset?: string }) {
  const style = themePreset ? themeStyleFromPreset(themePreset) : undefined;
  return (
    <div className={cn("min-h-screen p-6 space-y-6 transition-colors", themeClass)} style={style}>
      <FirstScreenTemplate title="CRM Workspace" description="Overview, contacts, pipeline, analytics, tasks">
        <div className="space-y-6">
          <DashboardOverview />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <PipelineSection />
              <AnalyticsSection />
            </div>
            <div className="space-y-6">
              <ContactsSection />
              <TasksSection />
            </div>
          </div>
        </div>
      </FirstScreenTemplate>
    </div>
  );
}

export function LeadsLayout({ themeClass, themePreset }: { themeClass?: string; themePreset?: string }) {
  const style = themePreset ? themeStyleFromPreset(themePreset) : undefined;
  return (
    <div className={cn("min-h-screen p-6 space-y-6 transition-colors", themeClass)} style={style}>
      <FirstScreenTemplate title="Leads Workspace" description="Focus on pipeline and active contacts">
        <div className="space-y-6">
          <DashboardOverview />
          <div className="grid grid-cols-1 gap-6">
             <PipelineSection />
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               <ContactsSection />
               <TasksSection />
             </div>
          </div>
        </div>
      </FirstScreenTemplate>
    </div>
  );
}

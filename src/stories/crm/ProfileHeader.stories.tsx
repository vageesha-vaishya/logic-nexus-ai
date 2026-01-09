import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Mail, Phone, Building2, Calendar, MoreHorizontal, 
  Star, Edit, Trash2, UserPlus, CheckCircle2 
} from 'lucide-react';
import { mockLeads, mockUsers } from './mock-data';
import { Lead } from '@/pages/dashboard/leads-data';

// Component Implementation for the Story
const ProfileHeader = ({ lead, user }: { lead: Lead; user: any }) => {
  const initials = `${lead.first_name[0]}${lead.last_name[0]}`;
  const statusColor = 
    lead.status === 'won' ? 'bg-green-100 text-green-700 border-green-200' :
    lead.status === 'new' ? 'bg-blue-100 text-blue-700 border-blue-200' :
    'bg-gray-100 text-gray-700 border-gray-200';

  return (
    <Card className="w-full max-w-5xl mx-auto overflow-hidden border-t-4 border-t-primary">
      <div className="bg-slate-50/50 p-6">
        <div className="flex flex-col md:flex-row gap-6 items-start justify-between">
          
          <div className="flex gap-5">
            <Avatar className="h-20 w-20 border-4 border-white shadow-sm">
              <AvatarImage src={`https://i.pravatar.cc/150?u=${lead.id}`} />
              <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary">{initials}</AvatarFallback>
            </Avatar>
            
            <div className="space-y-2">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                  {lead.first_name} {lead.last_name}
                  <Badge variant="outline" className={`capitalize font-semibold ${statusColor}`}>
                    {lead.status}
                  </Badge>
                </h1>
                <p className="text-slate-500 flex items-center gap-2 mt-1">
                  <Building2 className="h-4 w-4" />
                  {lead.company}
                  <span className="text-slate-300">•</span>
                  <span className="text-sm">{lead.title}</span>
                </p>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                  <Mail className="h-4 w-4" />
                  {lead.email}
                </a>
                <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                  <Phone className="h-4 w-4" />
                  {lead.phone}
                </a>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  Added {new Date(lead.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button variant="outline" size="sm">
                <UserPlus className="h-4 w-4 mr-2" />
                Assign
              </Button>
              <Button variant="default" size="sm">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Convert
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
            
            {user && (
              <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-3 py-1.5 rounded-full border shadow-sm">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Owner</span>
                <Avatar className="h-5 w-5">
                  <AvatarImage src={user.avatar} />
                  <AvatarFallback>{user.name[0]}</AvatarFallback>
                </Avatar>
                <span className="font-medium text-slate-700">{user.name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 divide-x border-t bg-white">
        <div className="p-4 text-center">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Lead Score</div>
          <div className="text-2xl font-bold text-slate-900 flex items-center justify-center gap-2">
            {lead.lead_score}
            <Star className={`h-5 w-5 ${lead.lead_score && lead.lead_score > 80 ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'}`} />
          </div>
        </div>
        <div className="p-4 text-center">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Potential Value</div>
          <div className="text-2xl font-bold text-slate-900">
            ${lead.estimated_value?.toLocaleString()}
          </div>
        </div>
        <div className="p-4 text-center">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Source</div>
          <div className="text-xl font-semibold text-slate-900 capitalize">
            {lead.source.replace('_', ' ')}
          </div>
        </div>
        <div className="p-4 text-center">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Last Activity</div>
          <div className="text-lg font-medium text-slate-700">
            {lead.last_activity_date ? new Date(lead.last_activity_date).toLocaleDateString() : 'Never'}
          </div>
        </div>
      </div>
    </Card>
  );
};

const meta: Meta<typeof ProfileHeader> = {
  title: 'CRM/Profile Header',
  component: ProfileHeader,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ProfileHeader>;

export const HighValueLead: Story = {
  args: {
    lead: mockLeads[2], // Won/High Value
    user: mockUsers[0],
  },
};

export const NewLead: Story = {
  args: {
    lead: mockLeads[0], // New
    user: mockUsers[1],
  },
};

export const UnassignedLead: Story = {
  args: {
    lead: mockLeads[3], // Unassigned
    user: null,
  },
};

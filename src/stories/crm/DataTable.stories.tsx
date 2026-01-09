import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { FirstScreenTemplate } from '@/components/system/FirstScreenTemplate';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { MoreHorizontal, ArrowUpDown } from 'lucide-react';
import { mockLeads } from './mock-data';

import { ViewMode } from '@/components/ui/view-toggle';

const DataTableDemo = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selected, setSelected] = useState<string[]>([]);

  const toggleSelect = (id: string) => {
    setSelected(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    setSelected(prev => 
      prev.length === mockLeads.length ? [] : mockLeads.map(l => l.id)
    );
  };

  return (
    <div className="h-screen bg-slate-50">
      <FirstScreenTemplate
        title="Leads"
        description="Manage your sales leads and potential opportunities."
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onCreate={() => alert('Create clicked')}
      >
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox 
                    checked={selected.length === mockLeads.length} 
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead className="w-[200px]">
                  <Button variant="ghost" className="p-0 hover:bg-transparent font-medium">
                    Name <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockLeads.map((lead) => (
                <TableRow key={lead.id} className="hover:bg-slate-50/50">
                  <TableCell>
                    <Checkbox 
                      checked={selected.includes(lead.id)}
                      onCheckedChange={() => toggleSelect(lead.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{lead.first_name} {lead.last_name}</span>
                      <span className="text-xs text-muted-foreground">{lead.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>{lead.company}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${
                            (lead.lead_score || 0) > 80 ? 'bg-green-500' : 
                            (lead.lead_score || 0) > 50 ? 'bg-yellow-500' : 'bg-red-500'
                          }`} 
                          style={{ width: `${lead.lead_score}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium">{lead.lead_score}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {lead.estimated_value ? 
                      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(lead.estimated_value) : 
                      '-'}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        <div className="flex items-center justify-end space-x-2 py-4">
          <div className="flex-1 text-sm text-muted-foreground">
            {selected.length} of {mockLeads.length} row(s) selected.
          </div>
          <div className="space-x-2">
            <Button variant="outline" size="sm">Previous</Button>
            <Button variant="outline" size="sm">Next</Button>
          </div>
        </div>
      </FirstScreenTemplate>
    </div>
  );
};

const meta: Meta = {
  title: 'CRM/Data Table',
  component: FirstScreenTemplate,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj;

export const LeadsList: Story = {
  render: () => <DataTableDemo />
};

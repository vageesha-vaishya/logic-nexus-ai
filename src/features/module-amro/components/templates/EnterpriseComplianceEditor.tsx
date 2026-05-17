/**
 * AMRO Enterprise Compliance Editor - WORKING VERSION
 * Direct Supabase integration with AD/SB feed
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Plus,
  Search,
  Trash2,
  CheckCircle,
  Clock,
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from "@/lib/logger";

interface ADSBFeedItem {
  id: string;
  directive_number: string;
  directive_type: string;
  regulatory_authority: string;
  title: string;
  description: string;
  compliance_deadline: string;
  priority: string;
}

interface ComplianceRequirement {
  id: string;
  ad_sb_id?: string;
  requirement_code: string;
  requirement_type: string;
  directive_number: string;
  regulatory_authority: string;
  title: string;
  compliance_deadline: string;
  compliance_status: string;
  severity_level: string;
}

interface EnterpriseComplianceEditorProps {
  requirements: ComplianceRequirement[];
  onChange: (requirements: ComplianceRequirement[]) => void;
  readOnly?: boolean;
}

export function EnterpriseComplianceEditor({
  requirements,
  onChange,
  readOnly = false,
}: EnterpriseComplianceEditorProps) {
  const [activeTab, setActiveTab] = useState('requirements');
  const [feedOpen, setFeedOpen] = useState(false);
  const [feedItems, setFeedItems] = useState<ADSBFeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  // Analytics
  const analytics = useMemo(() => {
    const total = requirements.length;
    const complied = requirements.filter((r) => r.compliance_status === 'complied').length;
    const overdue = requirements.filter((r) => {
      if (r.compliance_status === 'complied') return false;
      return new Date(r.compliance_deadline) < new Date();
    }).length;
    const rate = total > 0 ? (complied / total) * 100 : 0;

    return { total, complied, overdue, rate };
  }, [requirements]);

  // Load AD/SB feed
  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase.from('amro_compliance_ad_sb_registry').select('*').order('compliance_deadline', { ascending: true });
      
      if (filter !== 'all') {
        q = q.eq('regulatory_authority', filter);
      }

      const { data, error } = await q;
      
      logger.debug('=== COMPLIANCE FEED ===');
      logger.debug('Filter:', filter);
      logger.debug('Results:', data?.length || 0, data);
      logger.debug('Error:', error);
      logger.debug('=======================');
      
      if (error) {
        logger.error('Feed error:', error);
        setFeedItems([]);
      } else {
        setFeedItems(data || []);
      }
    } catch (error) {
      logger.error('Feed error:', error);
      setFeedItems([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Add from feed
  const addFromFeed = useCallback((item: ADSBFeedItem) => {
    const exists = requirements.find((r) => r.ad_sb_id === item.id);
    if (exists) {
      toast.error('Already added');
      return;
    }

    const newReq: ComplianceRequirement = {
      id: crypto.randomUUID(),
      ad_sb_id: item.id,
      requirement_code: item.directive_number,
      requirement_type: item.directive_type,
      directive_number: item.directive_number,
      regulatory_authority: item.regulatory_authority,
      title: item.title,
      compliance_deadline: item.compliance_deadline,
      compliance_status: 'not_started',
      severity_level: item.priority,
    };

    const updatedReqs = [...requirements, newReq];
    logger.debug('=== COMPLIANCE ADD ===');
    logger.debug('Adding requirement:', item.directive_number);
    logger.debug('Updated requirements array:', updatedReqs);
    logger.debug('Calling onChange with:', updatedReqs);
    onChange(updatedReqs);
    logger.debug('onChange called successfully');
    logger.debug('========================');
    toast.success('Requirement added');
  }, [requirements, onChange]);

  // Update requirement
  const updateRequirement = useCallback((id: string, updates: Partial<ComplianceRequirement>) => {
    onChange(requirements.map((req) => req.id === id ? { ...req, ...updates } : req));
  }, [requirements, onChange]);

  // Remove requirement
  const removeRequirement = useCallback((id: string) => {
    onChange(requirements.filter((req) => req.id !== id));
  }, [requirements, onChange]);

  const getSeverityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800',
    };
    return <Badge className={colors[severity] || 'bg-gray-100'}>{severity}</Badge>;
  };

  const getDaysRemaining = (deadline: string) => {
    const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="requirements">Requirements</TabsTrigger>
          <TabsTrigger value="feed">AD/SB Feed</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Requirements Tab */}
        <TabsContent value="requirements" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Compliance Requirements</h3>
              <p className="text-sm text-muted-foreground">
                {analytics.total} requirements • {analytics.rate.toFixed(0)}% compliance
              </p>
            </div>
            {!readOnly && (
              <Button variant="outline" size="sm" onClick={() => { setFeedOpen(true); loadFeed(); }}>
                <Plus className="h-4 w-4 mr-2" />
                Add from Feed
              </Button>
            )}
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Directive</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Authority</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Status</TableHead>
                  {!readOnly && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {requirements.map((req) => {
                  const days = getDaysRemaining(req.compliance_deadline);
                  const isOverdue = days < 0 && req.compliance_status !== 'complied';

                  return (
                    <TableRow key={req.id} className={isOverdue ? 'bg-red-50' : ''}>
                      <TableCell className="font-mono">{req.directive_number}</TableCell>
                      <TableCell>{req.title}</TableCell>
                      <TableCell>{req.regulatory_authority}</TableCell>
                      <TableCell>{getSeverityBadge(req.severity_level)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span className={isOverdue ? 'text-red-600 font-semibold' : ''}>
                            {new Date(req.compliance_deadline).toLocaleDateString()}
                          </span>
                        </div>
                        {req.compliance_status !== 'complied' && (
                          <div className={`text-xs ${isOverdue ? 'text-red-600' : 'text-muted-foreground'}`}>
                            {isOverdue ? `${Math.abs(days)}d overdue` : `${days}d remaining`}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {!readOnly ? (
                          <Select value={req.compliance_status} onValueChange={(v) => updateRequirement(req.id, { compliance_status: v })}>
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="not_started">Not Started</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="complied">Complied</SelectItem>
                              <SelectItem value="exempted">Exempted</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge>{req.compliance_status}</Badge>
                        )}
                      </TableCell>
                      {!readOnly && (
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => removeRequirement(req.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                {requirements.length === 0 && (
                  <TableRow><TableCell colSpan={readOnly ? 6 : 7} className="text-center py-8 text-muted-foreground">No requirements added. Click "Add from Feed" to browse AD/SB directives.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* AD/SB Feed Tab */}
        <TabsContent value="feed" className="space-y-4 pt-4">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold">AD/SB Regulatory Feed</h3>
            <Select value={filter} onValueChange={(v) => { setFilter(v); loadFeed(); }}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Authorities</SelectItem>
                <SelectItem value="FAA">FAA</SelectItem>
                <SelectItem value="EASA">EASA</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={loadFeed}><Search className="h-4 w-4 mr-2" />Refresh</Button>
          </div>

          {loading && <div className="text-center py-8">Loading feed...</div>}
          {!loading && feedItems.length > 0 && (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Directive</TableHead><TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Priority</TableHead><TableHead>Deadline</TableHead><TableHead>Action</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {feedItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono">{item.directive_number}</TableCell>
                      <TableCell>{item.title}</TableCell>
                      <TableCell><Badge variant="outline">{item.directive_type}</Badge></TableCell>
                      <TableCell>{getSeverityBadge(item.priority)}</TableCell>
                      <TableCell>{new Date(item.compliance_deadline).toLocaleDateString()}</TableCell>
                      <TableCell><Button size="sm" onClick={() => addFromFeed(item)}><Plus className="h-4 w-4 mr-1" />Add</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4 pt-4">
          <h3 className="text-lg font-semibold">Compliance Analytics</h3>
          <div className="grid grid-cols-4 gap-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Compliance Rate</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{analytics.rate.toFixed(1)}%</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Complied</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{analytics.complied}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Overdue</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">{analytics.overdue}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{analytics.total}</div></CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Feed Dialog */}
      <Dialog open={feedOpen} onOpenChange={setFeedOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Browse AD/SB Directives</DialogTitle></DialogHeader>
          {loading && <div className="text-center py-8">Loading...</div>}
          {!loading && feedItems.length > 0 && (
            <div className="border rounded-lg max-h-96 overflow-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Directive</TableHead><TableHead>Title</TableHead><TableHead>Priority</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {feedItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono">{item.directive_number}</TableCell>
                      <TableCell>{item.title}</TableCell>
                      <TableCell>{getSeverityBadge(item.priority)}</TableCell>
                      <TableCell><Button size="sm" onClick={() => addFromFeed(item)}><Plus className="h-4 w-4 mr-1" />Add</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

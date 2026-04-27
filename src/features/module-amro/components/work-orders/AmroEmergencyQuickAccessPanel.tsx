/**
 * AMRO Emergency Quick-Access Panel
 * 
 * Features:
 * - One-click AOG declaration
 * - Rapid WP creation (<5 fields required)
 * - Active emergencies dashboard
 * - Red-themed emergency UI
 * - Large touch targets for glove use
 * 
 * Design System:
 * - Uses AmroModuleSurface for container
 * - Uses AmroStandardToolbar for filters
 * - Uses AmroKpiGrid for emergency metrics
 * - Red-themed emergency styling
 */

import { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, Clock, Plus, RefreshCw, Siren, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AmroKpiGrid, AmroModuleSurface, AmroStandardToolbar } from '../parts/AmroPartsUiStandards';
import { AmroCrudDialogFooter } from '../parts/AmroCrudPrimitives';
import {
  useListEmergencyWP,
  useCreateEmergencyWP,
  type EmergencyWorkOrder,
  type EmergencyType,
  type UrgencyLevel,
} from './useEmergencyWPState';

const EMERGENCY_TYPE_CONFIG: Record<EmergencyType, { label: string; icon: any; color: string }> = {
  aog: { label: 'AOG', icon: Siren, color: 'text-red-600' },
  unscheduled_removal: { label: 'Unscheduled Removal', icon: AlertTriangle, color: 'text-orange-600' },
  flight_delay_risk: { label: 'Flight Delay Risk', icon: Clock, color: 'text-yellow-600' },
  safety_issue: { label: 'Safety Issue', icon: AlertTriangle, color: 'text-red-600' },
  technical_fault: { label: 'Technical Fault', icon: AlertTriangle, color: 'text-orange-600' },
};

const URGENCY_CONFIG: Record<UrgencyLevel, { label: string; color: string; bg: string }> = {
  immediate: { label: 'Immediate', color: 'text-white', bg: 'bg-red-600' },
  urgent: { label: 'Urgent', color: 'text-white', bg: 'bg-orange-600' },
  priority: { label: 'Priority', color: 'text-white', bg: 'bg-yellow-600' },
  routine: { label: 'Routine', color: 'text-black', bg: 'bg-blue-600' },
};

const DEFAULT_FORM = {
  aircraft_id: '',
  emergency_type: 'aog' as EmergencyType,
  urgency_level: 'immediate' as UrgencyLevel,
  reason: '',
  impact_assessment: '',
  estimated_ground_time_hours: '',
};

export function AmroEmergencyQuickAccessPanel(): JSX.Element {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [formValue, setFormValue] = useState({ ...DEFAULT_FORM });

  // Fetch emergency WPs
  const { data, isLoading, error } = useListEmergencyWP({
    page: 1,
    pageSize: 20,
    emergencyType: typeFilter === 'all' ? undefined : typeFilter as EmergencyType,
    status: statusFilter as 'active' | 'resolved' | undefined,
  });

  const createMutation = useCreateEmergencyWP();

  // Computed values
  const emergencies = useMemo(() => {
    const allEmergencies = data?.records || [];
    if (!search) return allEmergencies;
    const searchLower = search.toLowerCase();
    return allEmergencies.filter(
      (e) =>
        e.reason.toLowerCase().includes(searchLower) ||
        e.work_orders?.title.toLowerCase().includes(searchLower),
    );
  }, [data?.records, search]);

  const kpiData = useMemo(() => {
    const allEmergencies = data?.records || [];
    return {
      active: data?.active_count || allEmergencies.filter((e) => !e.resolved_at).length,
      aog: allEmergencies.filter((e) => e.emergency_type === 'aog' && !e.resolved_at).length,
      urgent: allEmergencies.filter((e) => e.urgency_level === 'immediate' && !e.resolved_at).length,
      total: allEmergencies.length,
    };
  }, [data]);

  // Handlers
  const handleQuickAOG = useCallback(() => {
    setFormValue({
      ...DEFAULT_FORM,
      emergency_type: 'aog',
      urgency_level: 'immediate',
    });
    setDialogOpen(true);
  }, []);

  const handleCreateEmergency = useCallback(() => {
    setFormValue({ ...DEFAULT_FORM });
    setDialogOpen(true);
  }, []);

  const handleFormSubmit = useCallback(async () => {
    if (!formValue.aircraft_id || !formValue.reason) {
      toast.error('Aircraft and reason are required');
      return;
    }

    setDialogLoading(true);
    try {
      await createMutation.mutateAsync({
        aircraft_id: formValue.aircraft_id,
        emergency_type: formValue.emergency_type,
        urgency_level: formValue.urgency_level,
        reason: formValue.reason,
        impact_assessment: formValue.impact_assessment || undefined,
        estimated_ground_time_hours: formValue.estimated_ground_time_hours
          ? Number(formValue.estimated_ground_time_hours)
          : undefined,
      });
      toast.success('Emergency work package created successfully');
      setDialogOpen(false);
      setFormValue({ ...DEFAULT_FORM });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create emergency work package');
    } finally {
      setDialogLoading(false);
    }
  }, [formValue, createMutation]);

  const formatTimeAgo = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  }, []);

  if (error) {
    return (
      <AmroModuleSurface>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <AlertTriangle className="mx-auto mb-2 h-12 w-12 text-destructive" />
          <p className="text-lg font-medium text-destructive">Failed to load emergencies</p>
          <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
        </div>
      </AmroModuleSurface>
    );
  }

  return (
    <AmroModuleSurface>
      {/* KPI Grid - Red themed for emergency */}
      <AmroKpiGrid
        kpiTiles={[
          {
            id: 'active',
            label: 'Active Emergencies',
            value: kpiData.active,
            icon: 'alert-triangle',
            trend: kpiData.active > 0 ? 'negative' : 'positive',
          },
          {
            id: 'aog',
            label: 'AOG',
            value: kpiData.aog,
            icon: 'siren',
            trend: kpiData.aog > 0 ? 'negative' : 'positive',
          },
          {
            id: 'urgent',
            label: 'Immediate',
            value: kpiData.urgent,
            icon: 'clock',
            trend: kpiData.urgent > 0 ? 'negative' : 'positive',
          },
          {
            id: 'total',
            label: 'Total',
            value: kpiData.total,
            icon: 'file-text',
            trend: 'neutral',
          },
        ]}
      />

      {/* Toolbar with Emergency Actions */}
      <AmroStandardToolbar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search emergencies...',
        }}
        filters={{
          type: {
            value: typeFilter,
            onChange: setTypeFilter,
            options: [
              { value: 'all', label: 'All Types' },
              { value: 'aog', label: 'AOG' },
              { value: 'unscheduled_removal', label: 'Unscheduled Removal' },
              { value: 'flight_delay_risk', label: 'Flight Delay Risk' },
              { value: 'safety_issue', label: 'Safety Issue' },
              { value: 'technical_fault', label: 'Technical Fault' },
            ],
          },
          status: {
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: 'active', label: 'Active' },
              { value: 'resolved', label: 'Resolved' },
              { value: 'all', label: 'All' },
            ],
          },
        }}
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={handleQuickAOG} variant="destructive" size="lg" className="h-12 px-6">
              <Siren className="mr-2 h-5 w-5" />
              Quick AOG
            </Button>
            <Button onClick={handleCreateEmergency} variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New Emergency
            </Button>
          </div>
        }
      />

      {/* Emergency List */}
      <div className="mt-6 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Loading emergencies...
          </div>
        ) : emergencies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 rounded-lg border bg-muted/20">
            <div className="rounded-full bg-green-100 dark:bg-green-900/20 p-4 mb-3">
              <Siren className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-lg font-medium">No Active Emergencies</p>
            <p className="text-sm text-muted-foreground mt-1">
              All aircraft are operational
            </p>
          </div>
        ) : (
          emergencies.map((emergency) => {
            const typeCfg = EMERGENCY_TYPE_CONFIG[emergency.emergency_type];
            const urgencyCfg = URGENCY_CONFIG[emergency.urgency_level];
            const TypeIcon = typeCfg.icon;

            return (
              <div
                key={emergency.id}
                className={`rounded-lg border-2 p-5 transition-all ${
                  emergency.resolved_at
                    ? 'border-muted bg-muted/10'
                    : emergency.urgency_level === 'immediate'
                    ? 'border-red-500 bg-red-50 dark:bg-red-950/20 animate-pulse'
                    : emergency.urgency_level === 'urgent'
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20'
                    : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <TypeIcon className={`h-6 w-6 ${typeCfg.color}`} />
                      <div>
                        <h3 className="text-lg font-semibold">
                          {emergency.work_orders?.title || 'Emergency Work Package'}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="destructive">{typeCfg.label}</Badge>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${urgencyCfg.bg} ${urgencyCfg.color}`}>
                            {urgencyCfg.label}
                          </span>
                          {!emergency.resolved_at && (
                            <span className="text-xs text-muted-foreground">
                              Declared {formatTimeAgo(emergency.declared_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm mt-2">{emergency.reason}</p>
                    {emergency.estimated_ground_time_hours && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Estimated ground time: {emergency.estimated_ground_time_hours}h
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {emergency.resolved_at ? (
                      <Badge variant="outline">Resolved</Badge>
                    ) : (
                      <Badge variant="destructive" className="animate-pulse">
                        Active
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Emergency Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Siren className="h-5 w-5 text-red-600" />
              Create Emergency Work Package
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 p-3">
              <p className="text-sm text-red-800 dark:text-red-200">
                <strong>Emergency:</strong> This will create a high-priority work package with automatic resource notification.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="aircraft_id">Aircraft ID *</Label>
                <Input
                  id="aircraft_id"
                  value={formValue.aircraft_id}
                  onChange={(e) => setFormValue({ ...formValue, aircraft_id: e.target.value })}
                  placeholder="e.g., VT-ABC"
                  required
                />
              </div>
              <div>
                <Label htmlFor="emergency_type">Emergency Type *</Label>
                <Select
                  value={formValue.emergency_type}
                  onValueChange={(val) => setFormValue({ ...formValue, emergency_type: val as EmergencyType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EMERGENCY_TYPE_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>
                        {cfg.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="urgency_level">Urgency Level *</Label>
              <Select
                value={formValue.urgency_level}
                onValueChange={(val) => setFormValue({ ...formValue, urgency_level: val as UrgencyLevel })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(URGENCY_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="reason">Reason *</Label>
              <Textarea
                id="reason"
                value={formValue.reason}
                onChange={(e) => setFormValue({ ...formValue, reason: e.target.value })}
                placeholder="Brief description of the emergency..."
                required
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="impact_assessment">Impact Assessment</Label>
                <Textarea
                  id="impact_assessment"
                  value={formValue.impact_assessment}
                  onChange={(e) => setFormValue({ ...formValue, impact_assessment: e.target.value })}
                  placeholder="Operational impact..."
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="estimated_ground_time_hours">Est. Ground Time (hours)</Label>
                <Input
                  id="estimated_ground_time_hours"
                  type="number"
                  value={formValue.estimated_ground_time_hours}
                  onChange={(e) => setFormValue({ ...formValue, estimated_ground_time_hours: e.target.value })}
                  placeholder="e.g., 24"
                />
              </div>
            </div>
          </div>
          <AmroCrudDialogFooter
            loading={dialogLoading}
            onCancel={() => setDialogOpen(false)}
            submitLabel="Create Emergency"
            submitVariant="destructive"
          />
        </DialogContent>
      </Dialog>
    </AmroModuleSurface>
  );
}

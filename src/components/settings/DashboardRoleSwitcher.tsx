import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { UserRole } from '@/types/dashboardTemplates';
import { toast } from 'sonner';

export function DashboardRoleSwitcher() {
  const { user, scopedDb } = useCRM();
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchCurrentRole = async () => {
      if (!user?.id) return;
      
      try {
        const { data, error } = await scopedDb
          .from('profiles')
          .select('dashboard_role')
          .eq('id', user.id)
          .single();

        if (!error && data) {
          setCurrentRole(data.dashboard_role as UserRole);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard role:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentRole();
  }, [user?.id, scopedDb]);

  const handleRoleChange = async (value: string) => {
    if (!user?.id) return;
    setSaving(true);
    
    try {
      const { error } = await scopedDb
        .from('profiles')
        .update({ dashboard_role: value })
        .eq('id', user.id);

      if (error) throw error;

      setCurrentRole(value as UserRole);
      toast.success('Dashboard view updated', {
        description: 'Refresh the page to see the new dashboard layout.',
      });
      
      // Optional: Force reload to apply changes immediately
      setTimeout(() => window.location.reload(), 1000);
      
    } catch (error) {
      console.error('Failed to update dashboard role:', error);
      toast.error('Failed to update dashboard view');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-32 bg-gray-100 rounded animate-pulse" />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-primary" />
          <CardTitle>Dashboard View</CardTitle>
        </div>
        <CardDescription>
          Switch your dashboard layout to view different role-based templates.
          Useful for testing or if you hold multiple roles.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <Select 
              value={currentRole || ''} 
              onValueChange={handleRoleChange}
              disabled={saving}
            >
              <SelectTrigger className="w-full sm:w-[300px]">
                <SelectValue placeholder="Select a dashboard role" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel className="font-semibold text-primary">CRM Module</SelectLabel>
                  <SelectItem value="crm_sales_rep">Sales Representative</SelectItem>
                  <SelectItem value="crm_sales_manager">Sales Manager</SelectItem>
                  <SelectItem value="crm_account_executive">Account Executive</SelectItem>
                  <SelectItem value="crm_executive">CRM Executive</SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel className="font-semibold text-primary">Logistics Module</SelectLabel>
                  <SelectItem value="logistics_dispatcher">Dispatcher</SelectItem>
                  <SelectItem value="logistics_fleet_manager">Fleet Manager</SelectItem>
                  <SelectItem value="logistics_ops_manager">Operations Manager</SelectItem>
                  <SelectItem value="logistics_executive">Logistics Executive</SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel className="font-semibold text-primary">Sales Module</SelectLabel>
                  <SelectItem value="sales_quote_manager">Quote Manager</SelectItem>
                  <SelectItem value="sales_manager">Regional Sales Manager</SelectItem>
                  <SelectItem value="sales_executive">VP of Sales</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          
          {currentRole && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>Current View: <span className="font-medium text-foreground">{currentRole.replace(/_/g, ' ')}</span></span>
            </div>
          )}
        </div>
        
        <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 p-3 rounded border border-amber-200">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>
            Changing this setting will update your profile preference and refresh the page.
            This affects which widgets and metrics you see on the main dashboard.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

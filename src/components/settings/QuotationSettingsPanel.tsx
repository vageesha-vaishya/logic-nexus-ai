import React, { useEffect, useState } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { QuotationConfigurationService, BrandingSettings } from '@/services/quotation/QuotationConfigurationService';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BrandingSettingsForm } from './BrandingSettingsForm';

export function QuotationSettingsPanel() {
  const { scopedDb, context } = useCRM();
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const service = new QuotationConfigurationService(scopedDb);

  useEffect(() => {
    const loadConfig = async () => {
      if (!context.tenantId) return;
      try {
        setLoading(true);
        const data = await service.getConfiguration(context.tenantId);
        setConfig(data);
      } catch (err) {
        console.error('Failed to load quotation config:', err);
        toast.error('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, [context.tenantId]);

  const handleToggleSmartMode = async (checked: boolean) => {
    try {
      setSaving(true);
      const updated = await service.updateConfiguration(context.tenantId!, {
        smart_mode_enabled: checked
      });
      setConfig(updated);
      toast.success(`Smart Quote Mode ${checked ? 'Enabled' : 'Disabled'}`);
    } catch (err: any) {
      toast.error('Failed to update setting', { description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleMultiOption = async (checked: boolean) => {
    try {
      setSaving(true);
      const updated = await service.updateConfiguration(context.tenantId!, {
        multi_option_enabled: checked
      });
      setConfig(updated);
      toast.success(`Multi-Option Quoting ${checked ? 'Enabled' : 'Disabled'}`);
    } catch (err: any) {
      toast.error('Failed to update setting', { description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBranding = async (settings: BrandingSettings) => {
    try {
      setSaving(true);
      const updated = await service.updateConfiguration(context.tenantId!, {
        branding_settings: settings
      });
      setConfig(updated);
      toast.success('Branding settings saved');
    } catch (err: any) {
      console.error('Save branding failed:', err);
      toast.error('Failed to save branding', { description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="general">General Configuration</TabsTrigger>
          <TabsTrigger value="branding">Branding & Assets</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quotation Engine Configuration</CardTitle>
              <CardDescription>Manage how quotations are generated and processed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-1">
                  <Label htmlFor="smart-mode" className="text-base">Smart Quote Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable AI-driven recommendations and automated routing suggestions.
                  </p>
                </div>
                <Switch
                  id="smart-mode"
                  checked={config?.smart_mode_enabled}
                  onCheckedChange={handleToggleSmartMode}
                  disabled={saving}
                />
              </div>
              
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-1">
                  <Label htmlFor="multi-option" className="text-base">Multi-Option Quoting</Label>
                  <p className="text-sm text-muted-foreground">
                    Generate multiple carrier options per quote for comparison.
                  </p>
                </div>
                <Switch
                  id="multi-option"
                  checked={config?.multi_option_enabled}
                  onCheckedChange={handleToggleMultiOption}
                  disabled={saving}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="branding">
          <BrandingSettingsForm 
            initialSettings={config?.branding_settings} 
            onSave={handleSaveBranding}
            saving={saving}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

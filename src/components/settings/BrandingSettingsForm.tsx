import React, { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileUpload } from '@/components/ui/file-upload';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BrandingSettings } from '@/services/quotation/QuotationConfigurationService';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Save, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { logger } from "@/lib/logger";

interface BrandingSettingsFormProps {
  initialSettings: BrandingSettings;
  onSave: (settings: BrandingSettings) => Promise<void>;
  saving: boolean;
}

const ColorPicker = ({ label, field, value, onChange }: { label: string, field: keyof BrandingSettings, value: string, onChange: (field: keyof BrandingSettings, value: string) => void }) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    <div className="flex items-center gap-3">
      <div className="relative w-12 h-12 rounded-lg border overflow-hidden shadow-sm">
        <input
          type="color"
          value={value || '#000000'}
          onChange={(e) => onChange(field, e.target.value)}
          className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer p-0 border-0"
        />
      </div>
      <Input
        value={value || ''}
        onChange={(e) => onChange(field, e.target.value)}
        placeholder="#000000"
        className="font-mono w-32"
        maxLength={7}
      />
    </div>
  </div>
);

export function BrandingSettingsForm({ initialSettings, onSave, saving }: BrandingSettingsFormProps) {
  const { context, supabase } = useCRM();
  const [settings, setSettings] = useState<BrandingSettings>(initialSettings || {});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [domainOverridesText, setDomainOverridesText] = useState('');
  const [franchiseOverridesText, setFranchiseOverridesText] = useState('');

  // Sync initial settings when they change (e.g. loaded from parent)
  useEffect(() => {
    if (initialSettings) {
      setSettings(prev => ({ ...prev, ...initialSettings }));
      setDomainOverridesText(
        initialSettings.domain_overrides ? JSON.stringify(initialSettings.domain_overrides, null, 2) : ''
      );
      setFranchiseOverridesText(
        initialSettings.franchise_overrides ? JSON.stringify(initialSettings.franchise_overrides, null, 2) : ''
      );
    }
  }, [initialSettings]);

  const handleTextChange = (field: keyof BrandingSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = async (file: File) => {
    if (!context.tenantId) {
      toast.error('Tenant ID missing');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);
      setLogoFile(file);

      const fileExt = file.name.split('.').pop()?.toLowerCase();
    
    if (!['png', 'jpg', 'jpeg'].includes(fileExt || '')) {
      toast.error('Invalid file type. Please upload PNG or JPG.');
      return;
    }

    const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `${context.tenantId}/${fileName}`;

      // Upload to organization-assets bucket using raw supabase client
      const { data, error } = await supabase.storage
        .from('organization-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('organization-assets')
        .getPublicUrl(filePath);

      setSettings(prev => ({ ...prev, logo_url: publicUrl }));
      setUploadProgress(100);
      toast.success('Logo uploaded successfully');
    } catch (err: any) {
      logger.error('Upload failed:', err);
      toast.error('Logo upload failed', { description: err.message });
      setLogoFile(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setSettings(prev => ({ ...prev, logo_url: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let domainOverrides: Record<string, unknown> | undefined = undefined;
    let franchiseOverrides: Record<string, unknown> | undefined = undefined;

    try {
      if (domainOverridesText.trim()) {
        const parsed = JSON.parse(domainOverridesText);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          toast.error('Domain overrides must be a JSON object');
          return;
        }
        domainOverrides = parsed as Record<string, unknown>;
      }
      if (franchiseOverridesText.trim()) {
        const parsed = JSON.parse(franchiseOverridesText);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          toast.error('Franchise overrides must be a JSON object');
          return;
        }
        franchiseOverrides = parsed as Record<string, unknown>;
      }
    } catch {
      toast.error('Invalid JSON in branding overrides');
      return;
    }

    await onSave({
      ...settings,
      domain_overrides: domainOverrides,
      franchise_overrides: franchiseOverrides,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Brand Assets</CardTitle>
          <CardDescription>Upload your company logo and configure brand colors for documents.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Company Logo</Label>
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <div className="w-full sm:w-1/2">
                <FileUpload
                  onFileSelect={handleLogoUpload}
                  onClear={handleRemoveLogo}
                  accept="image/png,image/jpeg"
                  maxSize={2 * 1024 * 1024} // 2MB
                  label="Upload Logo (PNG, JPG)"
                  value={logoFile}
                  progress={uploading ? uploadProgress : undefined}
                  disabled={uploading || saving}
                />
              </div>
              
              {settings.logo_url && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Preview</Label>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={handleRemoveLogo}
                    >
                        Remove
                    </Button>
                  </div>
                  <div className="p-4 border rounded-lg bg-white/50 dark:bg-black/20 flex items-center justify-center min-w-[200px] min-h-[120px]">
                    <img 
                      src={settings.logo_url} 
                      alt="Company Logo" 
                      className="max-h-24 max-w-full object-contain" 
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ColorPicker label="Primary Color" field="primary_color" value={settings.primary_color || ''} onChange={handleTextChange} />
            <ColorPicker label="Secondary Color" field="secondary_color" value={settings.secondary_color || ''} onChange={handleTextChange} />
            <ColorPicker label="Accent Color" field="accent_color" value={settings.accent_color || ''} onChange={handleTextChange} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Company Details</CardTitle>
          <CardDescription>Information displayed on quotations and invoices.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                value={settings.company_name || ''}
                onChange={(e) => handleTextChange('company_name', e.target.value)}
                placeholder="e.g. Acme Logistics"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="font_family">Font Family (Google Fonts)</Label>
              <Input
                id="font_family"
                value={settings.font_family || ''}
                onChange={(e) => handleTextChange('font_family', e.target.value)}
                placeholder="e.g. Inter, Roboto, Open Sans"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company_address">Business Address</Label>
            <Textarea
              id="company_address"
              value={settings.company_address || ''}
              onChange={(e) => handleTextChange('company_address', e.target.value)}
              placeholder="Full business address..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Brand Delivery</CardTitle>
          <CardDescription>Configure white-label behavior, CDN assets, and custom CSS.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-1">
              <Label htmlFor="white_label_enabled">White Label Mode</Label>
              <p className="text-sm text-muted-foreground">Hide platform branding and use tenant identity.</p>
            </div>
            <Switch
              id="white_label_enabled"
              checked={Boolean(settings.white_label_enabled)}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, white_label_enabled: checked }))}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="favicon_url">Favicon URL</Label>
              <Input
                id="favicon_url"
                value={settings.favicon_url || ''}
                onChange={(e) => handleTextChange('favicon_url', e.target.value)}
                placeholder="https://cdn.example.com/tenant/favicon.ico"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cdn_base_url">CDN Base URL</Label>
              <Input
                id="cdn_base_url"
                value={settings.cdn_base_url || ''}
                onChange={(e) => handleTextChange('cdn_base_url', e.target.value)}
                placeholder="https://cdn.example.com/tenant-assets"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom_css">Custom CSS</Label>
            <Textarea
              id="custom_css"
              value={settings.custom_css || ''}
              onChange={(e) => handleTextChange('custom_css', e.target.value)}
              placeholder=":root { --sidebar-width: 18rem; }"
              rows={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="domain_overrides">Domain Overrides (JSON)</Label>
            <Textarea
              id="domain_overrides"
              value={domainOverridesText}
              onChange={(e) => setDomainOverridesText(e.target.value)}
              placeholder='{"tenant.example.com":{"primary_color":"#334155"}}'
              rows={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="franchise_overrides">Franchise Overrides (JSON)</Label>
            <Textarea
              id="franchise_overrides"
              value={franchiseOverridesText}
              onChange={(e) => setFranchiseOverridesText(e.target.value)}
              placeholder='{"franchise-uuid":{"logo_url":"https://cdn.example.com/logo.png"}}'
              rows={6}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Document Content</CardTitle>
          <CardDescription>Standard text to appear on generated PDFs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="header_text">Header Text</Label>
              <Input
                id="header_text"
                value={settings.header_text || ''}
                onChange={(e) => handleTextChange('header_text', e.target.value)}
                placeholder="Top right header text..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub_header_text">Sub-Header Text</Label>
              <Input
                id="sub_header_text"
                value={settings.sub_header_text || ''}
                onChange={(e) => handleTextChange('sub_header_text', e.target.value)}
                placeholder="Secondary header text..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="footer_text">Footer Text</Label>
            <Textarea
              id="footer_text"
              value={settings.footer_text || ''}
              onChange={(e) => handleTextChange('footer_text', e.target.value)}
              placeholder="Standard footer text (e.g. registration number)..."
              rows={2}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="disclaimer_text">Disclaimer / Terms</Label>
            <Textarea
              id="disclaimer_text"
              value={settings.disclaimer_text || ''}
              onChange={(e) => handleTextChange('disclaimer_text', e.target.value)}
              placeholder="Standard terms and conditions disclaimer..."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving || uploading} className="min-w-[120px]">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

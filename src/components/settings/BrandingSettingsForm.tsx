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

  // Sync initial settings when they change (e.g. loaded from parent)
  useEffect(() => {
    if (initialSettings) {
      setSettings(prev => ({ ...prev, ...initialSettings }));
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

      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `${context.tenantId}/${fileName}`;

      // Upload to organization-assets bucket using raw supabase client
      const { data, error } = await supabase.storage
        .from('organization-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
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
      console.error('Upload failed:', err);
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
    await onSave(settings);
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
                  accept="image/png,image/jpeg,image/svg+xml"
                  maxSize={2 * 1024 * 1024} // 2MB
                  label="Upload Logo (PNG, JPG, SVG)"
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

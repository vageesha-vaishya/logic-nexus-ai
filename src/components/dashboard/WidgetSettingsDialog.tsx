import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WidgetConfig, WidgetSize } from '@/types/dashboard';

interface WidgetSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: WidgetConfig | null;
  onSave: (id: string, updates: Partial<WidgetConfig>) => void;
}

export function WidgetSettingsDialog({
  open,
  onOpenChange,
  config,
  onSave,
}: WidgetSettingsDialogProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [size, setSize] = useState<WidgetSize>('medium');
  const [settings, setSettings] = useState<Record<string, any>>({});

  useEffect(() => {
    if (config) {
      setTitle(config.title);
      setSize(config.size);
      setSettings(config.settings || {});
    }
  }, [config]);

  const handleSave = () => {
    if (config) {
      onSave(config.id, { title, size, settings });
      onOpenChange(false);
    }
  };

  if (!config) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('Edit Widget Settings')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">
              {t('Title')}
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="size" className="text-right">
              {t('Size')}
            </Label>
            <Select value={size} onValueChange={(v) => setSize(v as WidgetSize)}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder={t('Select size')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">{t('Small (1/4)')}</SelectItem>
                <SelectItem value="medium">{t('Medium (1/2)')}</SelectItem>
                <SelectItem value="large">{t('Large (3/4)')}</SelectItem>
                <SelectItem value="full">{t('Full Width')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.type === 'custom_chart' && (
            <>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">{t('Entity')}</Label>
                <Select 
                  value={settings.entity || 'leads'} 
                  onValueChange={(v) => setSettings({ ...settings, entity: v })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leads">{t('Leads')}</SelectItem>
                    <SelectItem value="opportunities">{t('Opportunities')}</SelectItem>
                    <SelectItem value="quotes">{t('Quotes')}</SelectItem>
                    <SelectItem value="shipments">{t('Shipments')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">{t('Group By')}</Label>
                <Select 
                  value={settings.groupBy || 'status'} 
                  onValueChange={(v) => setSettings({ ...settings, groupBy: v })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="status">{t('Status')}</SelectItem>
                    <SelectItem value="stage">{t('Stage')}</SelectItem>
                    <SelectItem value="type">{t('Type')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">{t('Chart Type')}</Label>
                <Select 
                  value={settings.chartType || 'bar'} 
                  onValueChange={(v) => setSettings({ ...settings, chartType: v })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bar">{t('Bar Chart')}</SelectItem>
                    <SelectItem value="line">{t('Line Chart')}</SelectItem>
                    <SelectItem value="pie">{t('Pie Chart')}</SelectItem>
                    <SelectItem value="area">{t('Area Chart')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {config.type === 'kanban' && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">{t('View Mode')}</Label>
              <Select 
                value={settings.module || 'overview'} 
                onValueChange={(v) => setSettings({ ...settings, module: v })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overview">{t('Pipelines Overview')}</SelectItem>
                  <SelectItem value="leads">{t('Leads Board')}</SelectItem>
                  <SelectItem value="opportunities">{t('Opportunities Board')}</SelectItem>
                  <SelectItem value="quotes">{t('Quotes Board')}</SelectItem>
                  <SelectItem value="shipments">{t('Shipments Board')}</SelectItem>
                  <SelectItem value="activities">{t('Activities Board')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSave}>
            {t('Save changes')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

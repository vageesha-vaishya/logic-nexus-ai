import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

interface LeadsBulkActionBarProps {
  selectedCount: number;
  onCancel: () => void;
  onDeleteClick: () => void;
}

export function LeadsBulkActionBar({ selectedCount, onCancel, onDeleteClick }: LeadsBulkActionBarProps) {
  const { t } = useTranslation();

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-popover text-popover-foreground shadow-lg border rounded-full px-6 py-3 flex items-center gap-4 z-50 animate-in fade-in slide-in-from-bottom-4">
      <span className="font-medium text-sm">{t('leads.bulk.selected', { count: selectedCount })}</span>
      <div className="h-4 w-px bg-border" />
      <Button variant="ghost" size="sm" onClick={onCancel}>
        {t('leads.actions.cancel')}
      </Button>
      <Button variant="destructive" size="sm" onClick={onDeleteClick}>
        <Trash2 className="mr-2 h-4 w-4" />
        {t('leads.actions.delete')}
      </Button>
    </div>
  );
}

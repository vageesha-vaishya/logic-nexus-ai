import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WidgetContainer } from '@/components/dashboard/WidgetContainer';
import { useTranslation } from 'react-i18next';
import { WidgetProps } from '@/types/dashboard';
import { useDashboardData } from '@/hooks/useDashboardData';

export function LeadsWidget({ config, onRemove, onEdit }: WidgetProps) {
  const { t } = useTranslation();
  // In a real app, we might want to fetch only this widget's data here
  // For now, we reuse the existing hook, but this might over-fetch if we have many widgets
  const { loading, myLeads } = useDashboardData();

  return (
    <WidgetContainer
      title={config.title || t('My Leads')}
      action={
        <Button variant="link" className="p-0" asChild>
          <Link to="/dashboard/leads">{t('View all')}</Link>
        </Button>
      }
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">{t('Loading...')}</p>
      ) : myLeads.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('No assigned leads yet')}</p>
      ) : (
        <ul className="space-y-3">
          {myLeads.map((l) => (
            <li key={l.id} className="flex items-center justify-between">
              <div>
                <Link to={`/dashboard/leads/${l.id}`} className="font-medium hover:underline">
                  {l.first_name} {l.last_name}
                </Link>
                {l.company && (
                  <span className="ml-2 text-sm text-muted-foreground">· {l.company}</span>
                )}
              </div>
              <Badge variant="secondary">{l.status}</Badge>
            </li>
          ))}
        </ul>
      )}
    </WidgetContainer>
  );
}

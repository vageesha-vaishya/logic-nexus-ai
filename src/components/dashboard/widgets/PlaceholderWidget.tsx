import { WidgetProps } from '@/types/dashboard';
import { WidgetContainer } from '@/components/dashboard/WidgetContainer';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function PlaceholderWidget({ config }: WidgetProps) {
  const { t } = useTranslation();
  
  // Map widget types to routes
  const routeMap: Record<string, string> = {
    accounts: '/dashboard/accounts',
    contacts: '/dashboard/contacts',
    quotes: '/dashboard/quotes',
    opportunities: '/dashboard/opportunities',
    shipments: '/dashboard/shipments',
  };

  const route = routeMap[config.type] || '/dashboard';

  return (
    <WidgetContainer
      title={config.title}
      action={
        <Button variant="link" className="p-0" asChild>
          <Link to={route}>{t('View all')}</Link>
        </Button>
      }
    >
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>{t('No data available yet for')} {config.title}</p>
      </div>
    </WidgetContainer>
  );
}

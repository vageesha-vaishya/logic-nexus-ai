import { Link } from 'react-router-dom';
import { Database, FileCheck2, Plane, Settings2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCRM } from '@/hooks/useCRM';

type DirectiveCardConfig = {
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
  icon: typeof Database;
  variant?: 'default' | 'outline' | 'secondary';
};

const DIRECTIVE_CARDS: DirectiveCardConfig[] = [
  {
    title: 'MPD',
    description: 'Manage aircraft, parts inventory, suppliers, maintenance facilities, work centers, and skill codes.',
    ctaLabel: 'Open MPD',
    href: '/dashboard/amro/settings/master-data/aircraft',
    icon: Database,
    variant: 'default',
  },
  {
    title: 'Configure MPD',
    description: 'Open the dedicated AMRO aircraft sub-module with full CRUD, validation, filters, sorting, and exports.',
    ctaLabel: 'Open Configure MPD',
    href: '/dashboard/amro/aircraft',
    icon: Plane,
    variant: 'default',
  },
  {
    title: 'New ADs/SBs',
    description: 'Configure reusable work package templates for aircraft maintenance planning and execution.',
    ctaLabel: 'View New ADs/SBs',
    href: '/dashboard/amro/aircraft/ad-sb',
    icon: FileCheck2,
    variant: 'outline',
  },
  {
    title: 'Configure ADs/SBs',
    description: 'Configure settings and processing parameters for Airworthiness Directives and Service Bulletins.',
    ctaLabel: 'Open Configure ADs/SBs',
    href: '/dashboard/amro/compliance',
    icon: Settings2,
    variant: 'outline',
  },
];

export function AmroPlanDirectivesBulletinPage() {
  const { context } = useCRM();

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">AMRO Settings</h1>
            <p className="text-sm text-muted-foreground">
              Consolidated MPD and AD/SB configuration surfaces with tenant-scoped controls and governed access.
            </p>
          </div>
          <Badge variant="secondary">Tenant: {context.tenantId || 'unscoped'}</Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {DIRECTIVE_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.title} className="border-primary/20">
                <CardHeader className="space-y-2 pb-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg">{card.title}</CardTitle>
                  <CardDescription className="min-h-[3rem]">{card.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button asChild variant={card.variant}>
                    <Link to={card.href}>{card.ctaLabel}</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default AmroPlanDirectivesBulletinPage;

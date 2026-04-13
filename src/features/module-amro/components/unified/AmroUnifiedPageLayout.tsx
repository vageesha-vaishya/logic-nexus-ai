/**
 * AmroUnifiedPageLayout
 * 
 * Standard page container for all AMRO modules.
 * Provides consistent layout with:
 * - FirstScreenTemplate wrapper
 * - Breadcrumbs
 * - Title and description
 * - Card-based content area
 * - Consistent spacing and padding
 * 
 * Usage:
 * <AmroUnifiedPageLayout
 *   title="Aircraft"
 *   description="Manage aircraft fleet records"
 *   breadcrumbs={[
 *     { label: 'Dashboard', to: '/dashboard' },
 *     { label: 'AMRO', to: '/dashboard/amro' },
 *     { label: 'Aircraft' },
 *   ]}
 * >
 *   {children}
 * </AmroUnifiedPageLayout>
 */

import { ReactNode } from 'react';
import { FirstScreenTemplate } from '@/components/system/FirstScreenTemplate';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export interface AmroUnifiedPageLayoutProps {
  /** Page title displayed in header */
  title: string;
  /** Page description/subtitle */
  description?: string;
  /** Breadcrumb navigation items */
  breadcrumbs: BreadcrumbItem[];
  /** Page content (typically a table or grid) */
  children: ReactNode;
  /** Additional header actions (e.g., New button) */
  headerActions?: ReactNode;
  /** View mode for the content area */
  viewMode?: 'list' | 'grid';
  /** KPI metrics to display in header */
  kpiMetrics?: Array<{
    label: string;
    value: string | number;
    icon?: ReactNode;
  }>;
}

export function AmroUnifiedPageLayout({
  title,
  description,
  breadcrumbs,
  children,
  headerActions,
  viewMode = 'list',
  kpiMetrics,
}: AmroUnifiedPageLayoutProps) {
  return (
    <FirstScreenTemplate
      title={title}
      description={description}
      breadcrumbs={breadcrumbs}
      viewMode={viewMode}
    >
      <div className="space-y-6">
        {/* Optional KPI Metrics Row */}
        {kpiMetrics && kpiMetrics.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiMetrics.map((metric, idx) => (
              <Card key={idx}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardDescription className="text-sm font-medium">
                    {metric.label}
                  </CardDescription>
                  {metric.icon && (
                    <div className="text-muted-foreground">
                      {metric.icon}
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metric.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Main Content Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{title}</CardTitle>
                {description && (
                  <CardDescription className="mt-1">
                    {description}
                  </CardDescription>
                )}
              </div>
              {headerActions && (
                <div className="flex items-center gap-2">
                  {headerActions}
                </div>
              )}
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
            {children}
          </CardContent>
        </Card>
      </div>
    </FirstScreenTemplate>
  );
}

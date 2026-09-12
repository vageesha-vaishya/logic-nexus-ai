import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight, LayoutGrid } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';

interface Breadcrumb {
  label: string;
  to?: string;
}

interface EnterpriseFormLayoutProps {
  breadcrumbs: Breadcrumb[];
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  status?: string;
  hideLabelSection?: boolean;
  hideTopStrip?: boolean;
}

export function EnterpriseFormLayout({
  breadcrumbs,
  title,
  actions,
  children,
  className,
  status,
  hideLabelSection = false,
  hideTopStrip = false,
}: EnterpriseFormLayoutProps) {
  return (
    <div className={cn("flex flex-col h-full bg-muted", className)}>
      {!hideTopStrip && (
        <div className="bg-primary text-primary-foreground px-4 h-12 flex items-center justify-between shadow-md shrink-0 z-30">
          <div className="flex items-center gap-6">
            {!hideLabelSection && (
              <div className="flex items-center gap-2 font-medium px-2 py-1">
                <LayoutGrid className="h-5 w-5" />
                <span>{breadcrumbs[0]?.label || 'App'}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white border-b px-4 py-2 flex items-center justify-between sticky top-0 z-20 shadow-sm h-14 shrink-0">
        <div className="flex items-center gap-4">
          {!hideLabelSection && (
            <>
              <span className="text-sm font-semibold text-foreground">{title}</span>
              <div className="h-6 w-px bg-gray-300 mx-2" />
              <nav className="flex items-center gap-1 text-sm text-muted-foreground">
                {breadcrumbs.map((crumb, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <ChevronRight className="h-3 w-3 text-gray-400" />}
                    {crumb.to ? (
                      <Link to={crumb.to} className="hover:text-primary transition-colors text-gray-900 font-medium">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="text-gray-500">{crumb.label}</span>
                    )}
                  </React.Fragment>
                ))}
              </nav>
              {status && (
                <Badge variant="secondary" className="rounded-full px-2 font-normal">
                  {status}
                </Badge>
              )}
            </>
          )}
          {actions}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 bg-gray-50/50">
        <div className="max-w-[1600px] mx-auto flex flex-col xl:flex-row gap-6 h-full items-stretch">
            {children}
        </div>
      </div>
    </div>
  );
}

import { forwardRef, useMemo } from 'react';
import type { HTMLAttributes } from 'react';
import { CRMCRUDLayout, CRMPageShell } from './templates';
import { CRMDataTable, CRMFilterBar } from './organisms';
import { CRMBadge, type CRMVariant, type CRMViewport } from './atoms';

const contacts = [
  { name: 'Alicia Morgan', email: 'alicia@soslogistics.ai', company: 'Acme Industrial', status: 'Active' },
  { name: 'Dev Patel', email: 'dev@bluefreight.io', company: 'Blue Freight', status: 'Prospect' },
  { name: 'Nadia Chen', email: 'nadia@portlane.com', company: 'Portlane', status: 'Negotiation' }
];

const deals = [
  { deal: 'Asia Pacific Expansion', owner: 'Alicia', stage: 'Proposal', value: '$120,000' },
  { deal: 'Cross-border Freight Bundle', owner: 'Dev', stage: 'Discovery', value: '$42,000' },
  { deal: 'Renewal 2026', owner: 'Nadia', stage: 'Closed Won', value: '$80,000' }
];

export interface CRMContactListPageProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CRMVariant;
  viewport?: CRMViewport;
}

export const CRMContactListPage = forwardRef<HTMLDivElement, CRMContactListPageProps>(
  ({ variant = 'primary', viewport = 'desktop', ...props }, ref) => (
    <CRMPageShell
      ref={ref}
      title="Contacts"
      subtitle="Centralized contact management with responsive design system components."
      variant={variant}
      viewport={viewport}
      navigationItems={[
        { id: 'contacts', label: 'Contacts', href: '#contacts', badge: '128' },
        { id: 'accounts', label: 'Accounts', href: '#accounts', badge: '64' },
        { id: 'activities', label: 'Activities', href: '#activities' }
      ]}
      activeNavId="contacts"
      {...props}
    >
      <CRMCRUDLayout
        title="Contact Registry"
        variant={variant}
        viewport={viewport}
        filters={<CRMFilterBar variant={variant} viewport={viewport} filters={[{ label: 'Status', value: 'Active' }]} />}
        table={
          <CRMDataTable
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'email', label: 'Email' },
              { key: 'company', label: 'Company' },
              { key: 'status', label: 'Status' }
            ]}
            rows={contacts}
            variant={variant}
            viewport={viewport}
          />
        }
      />
    </CRMPageShell>
  )
);

CRMContactListPage.displayName = 'CRMContactListPage';

export interface CRMDealPipelinePageProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CRMVariant;
  viewport?: CRMViewport;
}

export const CRMDealPipelinePage = forwardRef<HTMLDivElement, CRMDealPipelinePageProps>(
  ({ variant = 'primary', viewport = 'desktop', ...props }, ref) => {
    const stageCounts = useMemo(() => {
      const counts: Record<string, number> = {};
      deals.forEach((deal) => {
        counts[deal.stage] = (counts[deal.stage] || 0) + 1;
      });
      return counts;
    }, []);

    return (
      <CRMPageShell
        ref={ref}
        title="Deal Pipeline"
        subtitle="Revenue pipeline and stage conversion in CRM shell."
        variant={variant}
        viewport={viewport}
        navigationItems={[
          { id: 'pipeline', label: 'Pipeline', href: '#pipeline', badge: '16' },
          { id: 'quotes', label: 'Quotes', href: '#quotes', badge: '9' },
          { id: 'forecasts', label: 'Forecasts', href: '#forecasts' }
        ]}
        activeNavId="pipeline"
        {...props}
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {Object.entries(stageCounts).map(([stage, count]) => (
            <CRMBadge key={stage} variant={stage === 'Closed Won' ? 'primary' : variant}>
              {stage}: {count}
            </CRMBadge>
          ))}
        </div>
        <CRMCRUDLayout
          title="Open Deals"
          variant={variant}
          viewport={viewport}
          filters={<CRMFilterBar variant={variant} viewport={viewport} filters={[{ label: 'Owner', value: 'All' }]} />}
          table={
            <CRMDataTable
              columns={[
                { key: 'deal', label: 'Deal' },
                { key: 'owner', label: 'Owner' },
                { key: 'stage', label: 'Stage' },
                { key: 'value', label: 'Value' }
              ]}
              rows={deals}
              variant={variant}
              viewport={viewport}
            />
          }
        />
      </CRMPageShell>
    );
  }
);

CRMDealPipelinePage.displayName = 'CRMDealPipelinePage';

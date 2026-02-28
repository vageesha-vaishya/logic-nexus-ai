import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { QuotationSettingsPanel } from '@/components/settings/QuotationSettingsPanel';
import { DetailScreenTemplate } from '@/components/system/DetailScreenTemplate';

export default function QuotationSettings() {
  return (
    <DashboardLayout>
      <DetailScreenTemplate
        title="Quotation Settings"
        breadcrumbs={[
          { label: 'Dashboard', to: '/dashboard' },
          { label: 'Settings', to: '/dashboard/settings' },
          { label: 'Quotations' },
        ]}
      >
        <div className="max-w-3xl mx-auto">
          <QuotationSettingsPanel />
        </div>
      </DetailScreenTemplate>
    </DashboardLayout>
  );
}

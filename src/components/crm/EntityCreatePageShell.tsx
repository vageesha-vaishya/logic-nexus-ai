import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { EnterpriseFormLayout } from '@/components/ui/enterprise/EnterpriseFormLayout';
import { EnterpriseSheet } from '@/components/ui/enterprise/EnterpriseComponents';
import { UnifiedPartnerForm } from '@/components/crm/UnifiedPartnerForm';

interface EntityCreatePageShellProps {
  /** Page title, e.g. "New Account". */
  title: string;
  /** Breadcrumb label for the entity's list page, e.g. "Accounts". */
  listLabel: string;
  /** Route to the entity's list page, e.g. "/dashboard/accounts". */
  listPath: string;
  entityType: 'account' | 'contact';
  onSubmit: (data: any) => Promise<void>;
}

/**
 * AccountNew.tsx and ContactNew.tsx rendered an identical
 * EnterpriseFormLayout/EnterpriseSheet/UnifiedPartnerForm shell around
 * entirely different create-submit logic. This shell captures the shared
 * chrome; each page still owns its own onSubmit.
 */
export function EntityCreatePageShell({ title, listLabel, listPath, entityType, onSubmit }: EntityCreatePageShellProps) {
  const navigate = useNavigate();

  return (
    <div className="h-screen w-full bg-muted overflow-hidden">
      <EnterpriseFormLayout
        title={title}
        breadcrumbs={[
          { label: listLabel, to: listPath },
          { label: 'New' },
        ]}
        status="Draft"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate(listPath)}>
              Cancel
            </Button>
          </div>
        }
      >
        <EnterpriseSheet>
          <div className="p-6">
            <UnifiedPartnerForm
              entityType={entityType}
              mode="create"
              onSubmit={onSubmit}
              onCancel={() => navigate(listPath)}
            />
          </div>
        </EnterpriseSheet>
      </EnterpriseFormLayout>
    </div>
  );
}

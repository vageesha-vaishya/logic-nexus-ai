import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AmroWorkPackageTemplateAdapter } from './AmroWorkPackageTemplateAdapter';

vi.mock('@/features/module-amro/settings/pages/amro-settings-master-data/components/WorkPackageTemplateCreateSection', () => ({
  WorkPackageTemplateCreateSection: () => <div data-testid="legacy-work-package-section">Legacy Work Package Section</div>,
}));

describe('AmroWorkPackageTemplateAdapter', () => {
  const baseProps = {
    mode: 'update' as const,
    loading: false,
    formValues: { template_code: 'WP-001' },
    formErrors: {},
    setFieldValue: vi.fn(),
    firstFieldRef: { current: null },
    modalOpen: true,
    modalMode: 'update' as const,
    selectedTemplateId: 'wpt-1',
    scopedDb: {},
    scope: { tenantId: 'tenant-1', franchiseId: 'franchise-1' },
  };

  it('renders legacy section inside standard template container', () => {
    render(<AmroWorkPackageTemplateAdapter {...baseProps} />);
    expect(screen.getByTestId('amro-standard-form-template')).toBeInTheDocument();
    expect(screen.getByTestId('amro-wpt-standard-template')).toBeInTheDocument();
    expect(screen.getByTestId('legacy-work-package-section')).toBeInTheDocument();
    expect(screen.getByLabelText('Template Code (Standard)')).toBeInTheDocument();
    expect(screen.getByLabelText('Template Name (Standard)')).toBeInTheDocument();
  });

  it('surfaces validation errors from legacy formErrors', () => {
    render(
      <AmroWorkPackageTemplateAdapter
        {...baseProps}
        formErrors={{ template_code: 'Template Code is required' }}
      />,
    );

    expect(screen.getByText('Validation Errors')).toBeInTheDocument();
    expect(screen.getAllByText('Template Code is required').length).toBeGreaterThan(0);
  });
});

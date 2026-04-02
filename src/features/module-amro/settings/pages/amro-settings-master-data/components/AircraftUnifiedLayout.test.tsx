import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CalendarDays, FileText } from 'lucide-react';
import { AircraftUnifiedLayout, filterUnifiedModuleRows } from './AircraftUnifiedLayout';

describe('AircraftUnifiedLayout', () => {
  it('renders unified controls and supports module navigation callbacks', () => {
    const onNavigate = vi.fn();
    const onSearchChange = vi.fn();
    const onStatusChange = vi.fn();
    const onLocaleChange = vi.fn();
    const onClearFilters = vi.fn();

    render(
      <AircraftUnifiedLayout
        title="Aircraft · Templates"
        subtitle="Unified templates layout"
        activeModuleKey="templates"
        navItems={[
          { key: 'templates', label: 'Templates', path: '/dashboard/amro/aircraft/templates', icon: FileText },
          { key: 'work-packages', label: 'Maintenance Planning', path: '/dashboard/amro/aircraft/work-packages', icon: CalendarDays },
        ]}
        onNavigate={onNavigate}
        searchValue=""
        onSearchChange={onSearchChange}
        statusValue="all"
        onStatusChange={onStatusChange}
        statusOptions={[
          { value: 'all', label: 'All Statuses' },
          { value: 'active', label: 'Active' },
        ]}
        localeValue="en"
        onLocaleChange={onLocaleChange}
        localeOptions={[
          { value: 'en', label: 'English' },
          { value: 'fr', label: 'Français' },
        ]}
        resultSummary={{ visible: 12, total: 40 }}
        onClearFilters={onClearFilters}
      >
        <div>Templates body</div>
      </AircraftUnifiedLayout>,
    );

    expect(screen.getByTestId('aircraft-unified-layout')).toBeInTheDocument();
    expect(screen.getByText('Unified templates layout')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Maintenance Planning' }));
    expect(onNavigate).toHaveBeenCalledWith('/dashboard/amro/aircraft/work-packages');

    fireEvent.change(screen.getByLabelText('Unified module search'), { target: { value: 'A320' } });
    expect(onSearchChange).toHaveBeenCalledWith('A320');
    expect(screen.getByText('12/40 records')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it('supports localized labels and loading state text override', () => {
    render(
      <AircraftUnifiedLayout
        title="Avion · Documents"
        subtitle="Présentation unifiée"
        activeModuleKey="documents"
        navItems={[{ key: 'documents', label: 'Documents', path: '/dashboard/amro/aircraft/documents', icon: FileText }]}
        onNavigate={vi.fn()}
        searchValue=""
        onSearchChange={vi.fn()}
        statusValue="all"
        onStatusChange={vi.fn()}
        statusOptions={[{ value: 'all', label: 'Tous les statuts' }]}
        localeValue="fr"
        onLocaleChange={vi.fn()}
        localeOptions={[{ value: 'fr', label: 'Français' }]}
        loading
        labels={{
          searchPlaceholder: 'Recherche',
          searchAriaLabel: 'Recherche module',
          clearFilters: 'Réinitialiser',
          loadingMessage: 'Chargement localisé',
          resultLabel: 'lignes',
        }}
        resultSummary={{ visible: 2, total: 2 }}
      >
        <div>Documents body</div>
      </AircraftUnifiedLayout>,
    );

    expect(screen.getByLabelText('Recherche module')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réinitialiser' })).toBeInTheDocument();
    expect(screen.getByText('2/2 lignes')).toBeInTheDocument();
    expect(screen.getByText('Chargement localisé')).toBeInTheDocument();
  });

  it('filters rows by query and status using helper', () => {
    const rows = [
      { template_name: 'A320 Line', status: 'active', category: 'line' },
      { template_name: 'B737 Heavy', status: 'inactive', category: 'heavy' },
      { template_name: 'ATR Check', status: 'active', category: 'line' },
    ];

    const filtered = filterUnifiedModuleRows(
      rows,
      'a3',
      'active',
      (row) => [row.template_name, row.category],
      (row) => row.status,
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].template_name).toBe('A320 Line');
  });

  it('normalizes spacing and case in unified filtering helper', () => {
    const rows = [
      { name: 'Engine HPT', compliance: 'Compliant' },
      { name: 'Engine LPT', compliance: 'Critical' },
    ];
    const filtered = filterUnifiedModuleRows(
      rows,
      '  engine  ',
      '  compliant ',
      (row) => [row.name],
      (row) => row.compliance,
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('Engine HPT');
  });

  it('renders dynamic filter fields and invokes their callbacks', () => {
    const onTemplateTypeChange = vi.fn();
    const onDateChange = vi.fn();
    render(
      <AircraftUnifiedLayout
        title="Aircraft · Templates"
        subtitle="Dynamic filters"
        activeModuleKey="templates"
        navItems={[{ key: 'templates', label: 'Templates', path: '/dashboard/amro/aircraft/templates', icon: FileText }]}
        onNavigate={vi.fn()}
        searchValue=""
        onSearchChange={vi.fn()}
        statusValue="all"
        onStatusChange={vi.fn()}
        statusOptions={[{ value: 'all', label: 'All Statuses' }]}
        localeValue="en"
        onLocaleChange={vi.fn()}
        localeOptions={[{ value: 'en', label: 'English' }]}
        dynamicFilters={[
          {
            id: 'template-type',
            type: 'select',
            value: 'all',
            onValueChange: onTemplateTypeChange,
            ariaLabel: 'Template aircraft type',
            options: [
              { value: 'all', label: 'All Types' },
              { value: 'a320', label: 'A320' },
            ],
          },
          {
            id: 'effective-date',
            type: 'date',
            value: '',
            onValueChange: onDateChange,
            ariaLabel: 'Effective date',
          },
        ]}
      >
        <div>Dynamic body</div>
      </AircraftUnifiedLayout>,
    );

    fireEvent.click(screen.getByRole('combobox', { name: 'Template aircraft type' }));
    fireEvent.click(screen.getByRole('option', { name: 'A320' }));
    expect(onTemplateTypeChange).toHaveBeenCalledWith('a320');

    fireEvent.change(screen.getByLabelText('Effective date'), { target: { value: '2026-01-01' } });
    expect(onDateChange).toHaveBeenCalledWith('2026-01-01');
  });

  it('omits layout container when all sections are disabled and no body content exists', () => {
    render(
      <AircraftUnifiedLayout
        title="Aircraft · List"
        subtitle="Hidden layout"
        activeModuleKey="list"
        navItems={[{ key: 'list', label: 'Aircraft List', path: '/dashboard/amro/aircraft/list', icon: FileText }]}
        onNavigate={vi.fn()}
        searchValue=""
        onSearchChange={vi.fn()}
        statusValue="all"
        onStatusChange={vi.fn()}
        statusOptions={[{ value: 'all', label: 'All Statuses' }]}
        localeValue="en"
        onLocaleChange={vi.fn()}
        localeOptions={[{ value: 'en', label: 'English' }]}
        showHeaderSummary={false}
        showNavRail={false}
        showSearchControls={false}
        showResultSummary={false}
        showLocaleSelector={false}
        showDynamicFilters={false}
        showActions={false}
        showClearFilters={false}
      >
        <></>
      </AircraftUnifiedLayout>,
    );

    expect(screen.queryByTestId('aircraft-unified-layout')).not.toBeInTheDocument();
  });
});

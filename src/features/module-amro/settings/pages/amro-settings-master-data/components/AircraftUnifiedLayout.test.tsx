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
});

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CRMModuleHeaderNavigation } from '../CRMModuleHeaderNavigation';

describe('CRMModuleHeaderNavigation', () => {
  const setup = () => {
    const onViewModeChange = vi.fn();
    const onThemeChange = vi.fn();
    const onCreate = vi.fn();
    const onRefresh = vi.fn();
    const onImportExport = vi.fn();

    render(
      <CRMModuleHeaderNavigation
        moduleLabel="Leads"
        viewMode="pipeline"
        theme="Azure Sky"
        onViewModeChange={onViewModeChange}
        onThemeChange={onThemeChange}
        onCreate={onCreate}
        onRefresh={onRefresh}
        onImportExport={onImportExport}
        createLabel="New Lead"
      />,
    );

    return { onViewModeChange, onCreate, onRefresh, onImportExport };
  };

  it('renders required control sequence', () => {
    setup();

    const nav = screen.getByRole('navigation', { name: /leads header navigation/i });
    const labels = ['Pipeline', 'Card', 'Grid', 'List', 'New Lead', 'Refresh', 'Import/Export', 'Azure Sky'];
    const controlText = nav.textContent ?? '';
    let cursor = -1;

    labels.forEach((label) => {
      const next = controlText.indexOf(label, cursor + 1);
      expect(next).toBeGreaterThan(cursor);
      cursor = next;
    });

    expect(screen.queryByText('Set as Default')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /leads theme/i })).toBeInTheDocument();
  });

  it('changes view by keyboard navigation', () => {
    const { onViewModeChange } = setup();
    const pipelineButton = screen.getByRole('button', { name: /pipeline view/i });

    fireEvent.keyDown(pipelineButton, { key: 'ArrowRight' });
    expect(onViewModeChange).toHaveBeenCalledWith('card');
  });

  it('fires create refresh and import export actions', () => {
    const { onCreate, onRefresh, onImportExport } = setup();

    fireEvent.click(screen.getByRole('button', { name: /new lead/i }));
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    fireEvent.click(screen.getByRole('button', { name: /import.*export/i }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onImportExport).toHaveBeenCalledTimes(1);
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AmroInventoryDataGridTemplate, type GridColumnDefinition } from './AmroInventoryDataGridTemplate';

type RecordRow = {
  id: string;
  status: string;
  quantity: number;
};

const rows: RecordRow[] = [
  { id: 'INV-1', status: 'available', quantity: 12 },
  { id: 'INV-2', status: 'reserved', quantity: 4 },
];

const columns: GridColumnDefinition<RecordRow>[] = [
  { key: 'id', header: 'ID', sortable: true, filterable: true, resizable: true, dataType: 'text' },
  { key: 'status', header: 'Status', sortable: true, filterable: true, resizable: true, dataType: 'text' },
  { key: 'quantity', header: 'Quantity', sortable: true, filterable: false, resizable: true, dataType: 'numeric' },
];

describe('AmroInventoryDataGridTemplate collapse/restore UX', () => {
  it('supports grid-only, right-form, and split-view layout switching', () => {
    render(
      <AmroInventoryDataGridTemplate<RecordRow>
        records={rows}
        columns={columns}
        viewMode="split-view"
      />,
    );

    expect(screen.getByRole('button', { name: 'Grid-only layout' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Grid with right form layout' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Split view layout' })).toBeInTheDocument();
    expect(screen.getByText('Record Detail')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Grid-only layout' }));
    expect(screen.queryByText('Record Detail')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Grid with right form layout' }));
    expect(screen.getByText('Record Detail')).toBeInTheDocument();
  });

  it('keeps a restore control available after collapsing detail panel', () => {
    render(
      <AmroInventoryDataGridTemplate<RecordRow>
        records={rows}
        columns={columns}
        viewMode="horizontal-split"
      />,
    );

    const collapseDetail = screen.getByRole('button', { name: 'Collapse detail panel' });
    fireEvent.click(collapseDetail);

    expect(screen.getAllByRole('button', { name: 'Restore collapsed panels' }).length).toBeGreaterThan(0);
  });

  it('restores collapsed panels using keyboard shortcut', () => {
    render(
      <AmroInventoryDataGridTemplate<RecordRow>
        records={rows}
        columns={columns}
        viewMode="horizontal-split"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Collapse detail panel' }));
    expect(screen.getAllByRole('button', { name: 'Restore collapsed panels' }).length).toBeGreaterThan(0);

    fireEvent.keyDown(screen.getByTestId('inventory-workspace-content'), {
      key: 'E',
      ctrlKey: true,
      shiftKey: true,
    });

    expect(screen.queryAllByRole('button', { name: 'Restore collapsed panels' }).length).toBe(0);
  });

  it('emits CRUD callbacks from detail action bar after row selection', () => {
    const onCrudAction = vi.fn();
    const onSaveRecord = vi.fn();

    render(
      <AmroInventoryDataGridTemplate<RecordRow>
        records={rows}
        columns={columns}
        viewMode="horizontal-split"
        onCrudAction={onCrudAction}
        onSaveRecord={onSaveRecord}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Update record' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save record' }));

    expect(onCrudAction).toHaveBeenCalledWith('update', expect.objectContaining({ id: 'INV-1' }));
    expect(onCrudAction).toHaveBeenCalledWith('save', expect.objectContaining({ id: 'INV-1' }));
    expect(onSaveRecord).toHaveBeenCalledWith(expect.objectContaining({ id: 'INV-1' }));
  });

  it('requires delete confirmation before firing delete callback', () => {
    const onDeleteRecord = vi.fn();

    render(
      <AmroInventoryDataGridTemplate<RecordRow>
        records={rows}
        columns={columns}
        viewMode="horizontal-split"
        onDeleteRecord={onDeleteRecord}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete record' }));
    expect(screen.getByText('Delete Record?')).toBeInTheDocument();
    expect(onDeleteRecord).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Delete' }));
    expect(onDeleteRecord).toHaveBeenCalledWith(expect.objectContaining({ id: 'INV-1' }));
  });

  it('renders persistent separator boxes between record detail sections', () => {
    render(
      <AmroInventoryDataGridTemplate<RecordRow>
        records={rows}
        columns={columns}
        viewMode="horizontal-split"
      />,
    );

    const separators = screen.getAllByTestId('record-detail-separator-box');
    expect(separators.length).toBeGreaterThan(0);
    separators.forEach((separator) => {
      expect(separator.className).toContain('relative');
      expect(separator.className).toContain('z-10');
      expect(separator.className.includes('absolute')).toBe(false);
    });
  });

  it('keeps an explicit right-side border rail on record detail container', () => {
    render(
      <AmroInventoryDataGridTemplate<RecordRow>
        records={rows}
        columns={columns}
        viewMode="horizontal-split"
      />,
    );

    expect(screen.getByTestId('record-detail-right-border')).toBeInTheDocument();
  });
});

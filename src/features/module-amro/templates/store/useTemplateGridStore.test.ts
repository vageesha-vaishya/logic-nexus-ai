/**
 * Unit Tests for useTemplateGridStore
 * 
 * Tests Zustand store for template grid state management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useTemplateGridStore } from './useTemplateGridStore';

describe('useTemplateGridStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useTemplateGridStore.getState().resetState();
  });

  describe('Pagination', () => {
    it('should have default pagination state', () => {
      const state = useTemplateGridStore.getState();
      expect(state.pageIndex).toBe(0);
      expect(state.pageSize).toBe(20);
      expect(state.totalCount).toBe(0);
    });

    it('should update page index', () => {
      act(() => {
        useTemplateGridStore.getState().setPageIndex(5);
      });
      expect(useTemplateGridStore.getState().pageIndex).toBe(5);
    });

    it('should update page size and reset page index', () => {
      act(() => {
        useTemplateGridStore.getState().setPageIndex(3);
        useTemplateGridStore.getState().setPageSize(50);
      });
      
      const state = useTemplateGridStore.getState();
      expect(state.pageSize).toBe(50);
      expect(state.pageIndex).toBe(0); // Should reset to 0
    });

    it('should update total count', () => {
      act(() => {
        useTemplateGridStore.getState().setTotalCount(100);
      });
      expect(useTemplateGridStore.getState().totalCount).toBe(100);
    });

    it('should reset pagination', () => {
      act(() => {
        useTemplateGridStore.getState().setPageIndex(5);
        useTemplateGridStore.getState().setPageSize(50);
        useTemplateGridStore.getState().setTotalCount(100);
        useTemplateGridStore.getState().resetPagination();
      });

      const state = useTemplateGridStore.getState();
      expect(state.pageIndex).toBe(0);
      expect(state.pageSize).toBe(50); // Should keep page size
      expect(state.totalCount).toBe(100); // Should keep total count
    });
  });

  describe('Sorting', () => {
    it('should have empty sort by default', () => {
      expect(useTemplateGridStore.getState().sort).toEqual([]);
    });

    it('should set sort configuration', () => {
      act(() => {
        useTemplateGridStore.getState().setSort([{ field: 'template_name', direction: 'asc' }]);
      });
      expect(useTemplateGridStore.getState().sort).toEqual([
        { field: 'template_name', direction: 'asc' },
      ]);
    });

    it('should add sort for new field', () => {
      act(() => {
        useTemplateGridStore.getState().addSort('template_name', 'asc');
      });
      expect(useTemplateGridStore.getState().sort).toEqual([
        { field: 'template_name', direction: 'asc' },
      ]);
    });

    it('should update existing sort direction', () => {
      act(() => {
        useTemplateGridStore.getState().addSort('template_name', 'asc');
        useTemplateGridStore.getState().addSort('template_name', 'desc');
      });
      expect(useTemplateGridStore.getState().sort).toEqual([
        { field: 'template_name', direction: 'desc' },
      ]);
    });

    it('should support multi-column sort', () => {
      act(() => {
        useTemplateGridStore.getState().addSort('template_name', 'asc');
        useTemplateGridStore.getState().addSort('version', 'desc');
      });
      expect(useTemplateGridStore.getState().sort).toEqual([
        { field: 'template_name', direction: 'asc' },
        { field: 'version', direction: 'desc' },
      ]);
    });

    it('should remove sort field', () => {
      act(() => {
        useTemplateGridStore.getState().addSort('template_name', 'asc');
        useTemplateGridStore.getState().addSort('version', 'desc');
        useTemplateGridStore.getState().removeSort('template_name');
      });
      expect(useTemplateGridStore.getState().sort).toEqual([
        { field: 'version', direction: 'desc' },
      ]);
    });

    it('should clear all sorts', () => {
      act(() => {
        useTemplateGridStore.getState().addSort('template_name', 'asc');
        useTemplateGridStore.getState().addSort('version', 'desc');
        useTemplateGridStore.getState().clearSort();
      });
      expect(useTemplateGridStore.getState().sort).toEqual([]);
    });
  });

  describe('Filtering', () => {
    it('should have default filters', () => {
      const { filters } = useTemplateGridStore.getState();
      expect(filters.search).toBe('');
      expect(filters.maintenanceType).toBeNull();
      expect(filters.status).toBeNull();
      expect(filters.aircraftModels).toEqual([]);
    });

    it('should update search filter', () => {
      act(() => {
        useTemplateGridStore.getState().setFilters({ search: 'test' });
      });
      expect(useTemplateGridStore.getState().filters.search).toBe('test');
    });

    it('should update maintenance type filter', () => {
      act(() => {
        useTemplateGridStore.getState().setFilters({ maintenanceType: 'line' });
      });
      expect(useTemplateGridStore.getState().filters.maintenanceType).toBe('line');
    });

    it('should update status filter', () => {
      act(() => {
        useTemplateGridStore.getState().setFilters({ status: 'active' });
      });
      expect(useTemplateGridStore.getState().filters.status).toBe('active');
    });

    it('should update aircraft models filter', () => {
      act(() => {
        useTemplateGridStore.getState().setFilters({ aircraftModels: ['A320', 'B737'] });
      });
      expect(useTemplateGridStore.getState().filters.aircraftModels).toEqual(['A320', 'B737']);
    });

    it('should update multiple filters at once', () => {
      act(() => {
        useTemplateGridStore.getState().setFilters({
          search: 'check',
          maintenanceType: 'line',
          status: 'active',
        });
      });

      const { filters } = useTemplateGridStore.getState();
      expect(filters.search).toBe('check');
      expect(filters.maintenanceType).toBe('line');
      expect(filters.status).toBe('active');
    });

    it('should reset filters to defaults', () => {
      act(() => {
        useTemplateGridStore.getState().setFilters({
          search: 'test',
          maintenanceType: 'line',
          status: 'active',
          aircraftModels: ['A320'],
        });
        useTemplateGridStore.getState().resetFilters();
      });

      const { filters } = useTemplateGridStore.getState();
      expect(filters.search).toBe('');
      expect(filters.maintenanceType).toBeNull();
      expect(filters.status).toBeNull();
      expect(filters.aircraftModels).toEqual([]);
    });
  });

  describe('Selection', () => {
    it('should have empty selection by default', () => {
      expect(useTemplateGridStore.getState().selectedIds.size).toBe(0);
    });

    it('should toggle selection on', () => {
      act(() => {
        useTemplateGridStore.getState().toggleSelection('template-1');
      });
      expect(useTemplateGridStore.getState().selectedIds.has('template-1')).toBe(true);
    });

    it('should toggle selection off', () => {
      act(() => {
        useTemplateGridStore.getState().toggleSelection('template-1');
        useTemplateGridStore.getState().toggleSelection('template-1');
      });
      expect(useTemplateGridStore.getState().selectedIds.has('template-1')).toBe(false);
    });

    it('should select multiple templates', () => {
      act(() => {
        useTemplateGridStore.getState().toggleSelection('template-1');
        useTemplateGridStore.getState().toggleSelection('template-2');
        useTemplateGridStore.getState().toggleSelection('template-3');
      });
      expect(useTemplateGridStore.getState().selectedIds.size).toBe(3);
    });

    it('should deselect all', () => {
      act(() => {
        useTemplateGridStore.getState().toggleSelection('template-1');
        useTemplateGridStore.getState().toggleSelection('template-2');
        useTemplateGridStore.getState().deselectAll();
      });
      expect(useTemplateGridStore.getState().selectedIds.size).toBe(0);
    });

    it('should set selection directly', () => {
      const ids = new Set(['template-1', 'template-2']);
      act(() => {
        useTemplateGridStore.getState().setSelection(ids);
      });
      expect(useTemplateGridStore.getState().selectedIds).toEqual(ids);
    });
  });

  describe('Column Management', () => {
    it('should have default column visibility', () => {
      const { columnVisibility } = useTemplateGridStore.getState();
      expect(columnVisibility.template_code).toBe(true);
      expect(columnVisibility.template_name).toBe(true);
      expect(columnVisibility.description).toBe(false); // Hidden by default
    });

    it('should toggle column visibility', () => {
      act(() => {
        useTemplateGridStore.getState().toggleColumnVisibility('description');
      });
      expect(useTemplateGridStore.getState().columnVisibility.description).toBe(true);
    });

    it('should set column visibility', () => {
      act(() => {
        useTemplateGridStore.getState().setColumnVisibility({
          template_code: true,
          template_name: false,
        });
      });
      
      const { columnVisibility } = useTemplateGridStore.getState();
      expect(columnVisibility.template_code).toBe(true);
      expect(columnVisibility.template_name).toBe(false);
    });

    it('should update column size', () => {
      act(() => {
        useTemplateGridStore.getState().setColumnSize('template_code', 200);
      });
      expect(useTemplateGridStore.getState().columnSizes.template_code).toBe(200);
    });

    it('should set column order', () => {
      const newOrder = ['template_name', 'template_code', 'status'];
      act(() => {
        useTemplateGridStore.getState().setColumnOrder(newOrder);
      });
      expect(useTemplateGridStore.getState().columnOrder).toEqual(newOrder);
    });

    it('should reset column preferences', () => {
      act(() => {
        useTemplateGridStore.getState().toggleColumnVisibility('description');
        useTemplateGridStore.getState().setColumnSize('template_code', 200);
        useTemplateGridStore.getState().resetColumnPreferences();
      });

      const state = useTemplateGridStore.getState();
      expect(state.columnVisibility.description).toBe(false);
      expect(state.columnSizes).toEqual({});
    });
  });

  describe('UI State', () => {
    it('should have default density', () => {
      expect(useTemplateGridStore.getState().density).toBe('normal');
    });

    it('should update density', () => {
      act(() => {
        useTemplateGridStore.getState().setDensity('compact');
      });
      expect(useTemplateGridStore.getState().density).toBe('compact');
    });

    it('should have default view mode', () => {
      expect(useTemplateGridStore.getState().viewMode).toBe('table');
    });

    it('should update view mode', () => {
      act(() => {
        useTemplateGridStore.getState().setViewMode('card');
      });
      expect(useTemplateGridStore.getState().viewMode).toBe('card');
    });

    it('should set context menu', () => {
      const menuState = { x: 100, y: 200, rowId: 'template-1' };
      act(() => {
        useTemplateGridStore.getState().setContextMenu(menuState);
      });
      expect(useTemplateGridStore.getState().contextMenu).toEqual(menuState);
    });

    it('should clear context menu', () => {
      act(() => {
        useTemplateGridStore.getState().setContextMenu({ x: 100, y: 200, rowId: 'template-1' });
        useTemplateGridStore.getState().setContextMenu(null);
      });
      expect(useTemplateGridStore.getState().contextMenu).toBeNull();
    });
  });

  describe('Bulk Operations', () => {
    it('should have null bulk operation by default', () => {
      expect(useTemplateGridStore.getState().bulkOperation).toBeNull();
    });

    it('should set bulk operation', () => {
      const operation = {
        type: 'delete' as const,
        progress: 0,
        total: 10,
        status: 'in-progress' as const,
        error: null,
      };

      act(() => {
        useTemplateGridStore.getState().setBulkOperation(operation);
      });
      expect(useTemplateGridStore.getState().bulkOperation).toEqual(operation);
    });

    it('should clear bulk operation', () => {
      act(() => {
        useTemplateGridStore.getState().setBulkOperation({
          type: 'delete',
          progress: 0,
          total: 10,
          status: 'in-progress',
          error: null,
        });
        useTemplateGridStore.getState().setBulkOperation(null);
      });
      expect(useTemplateGridStore.getState().bulkOperation).toBeNull();
    });
  });

  describe('Reset State', () => {
    it('should reset all state to defaults', () => {
      act(() => {
        const state = useTemplateGridStore.getState();
        state.setPageIndex(5);
        state.setPageSize(50);
        state.setTotalCount(100);
        state.addSort('template_name', 'asc');
        state.setFilters({ search: 'test' });
        state.toggleSelection('template-1');
        state.setDensity('compact');
        state.setViewMode('card');
        state.resetState();
      });

      const state = useTemplateGridStore.getState();
      expect(state.pageIndex).toBe(0);
      expect(state.pageSize).toBe(20);
      expect(state.totalCount).toBe(0);
      expect(state.sort).toEqual([]);
      expect(state.filters.search).toBe('');
      expect(state.selectedIds.size).toBe(0);
      expect(state.density).toBe('normal');
      expect(state.viewMode).toBe('table');
    });
  });
});

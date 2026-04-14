/**
 * Unit Tests for Template Service
 * 
 * Tests API service layer for work package templates
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  cloneTemplate,
  bulkDeleteTemplates,
  bulkUpdateTemplateStatus,
  fetchAircraftModels,
} from './templateService';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Template Service', () => {
  const mockAccessToken = 'test-token';
  const mockTemplateId = 'template-123';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('fetchTemplates', () => {
    it('should fetch templates with default params', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          data: [
            {
              id: '1',
              template_code: 'TPL-001',
              template_name: 'Test Template',
              maintenance_type: 'line',
              version: 1,
              active: true,
              status: 'active',
            },
          ],
          total: 1,
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await fetchTemplates(mockAccessToken, {
        page: 1,
        pageSize: 20,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v2/amro/master-data/work_package_templates'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );

      expect(result.templates).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.templates[0].template_code).toBe('TPL-001');
    });

    it('should fetch templates with filters', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          data: [],
          total: 0,
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await fetchTemplates(mockAccessToken, {
        page: 1,
        pageSize: 20,
        search: 'check',
        maintenanceType: 'line',
        status: 'active',
      });

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('search=check');
      expect(callUrl).toContain('maintenance_type=line');
      expect(callUrl).toContain('status=active');
    });

    it('should fetch templates with sort', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          data: [],
          total: 0,
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await fetchTemplates(mockAccessToken, {
        page: 1,
        pageSize: 20,
        sort: 'template_name:asc,version:desc',
      });

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('sort=template_name:asc,version:desc');
    });

    it('should handle API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(
        fetchTemplates(mockAccessToken, { page: 1, pageSize: 20 })
      ).rejects.toThrow('Failed to fetch templates');
    });

    it('should handle timeout', async () => {
      mockFetch.mockImplementation(() => new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 15000);
      }));

      await expect(
        fetchTemplates(mockAccessToken, { page: 1, pageSize: 20 })
      ).rejects.toThrow('Request timeout');
    });
  });

  describe('createTemplate', () => {
    it('should create a new template', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          data: {
            id: 'new-id',
            template_code: 'TPL-NEW',
            template_name: 'New Template',
            maintenance_type: 'line',
            version: 1,
            active: true,
            status: 'draft',
          },
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await createTemplate(mockAccessToken, {
        template_code: 'TPL-NEW',
        template_name: 'New Template',
        maintenance_type: 'line',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v2/amro/master-data/work_package_templates'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            template_code: 'TPL-NEW',
            template_name: 'New Template',
            maintenance_type: 'line',
          }),
        })
      );

      expect(result.template_code).toBe('TPL-NEW');
      expect(result.template_name).toBe('New Template');
    });

    it('should handle create error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Template code already exists' }),
      });

      await expect(
        createTemplate(mockAccessToken, {
          template_code: 'EXISTING',
          template_name: 'Test',
        })
      ).rejects.toThrow('Template code already exists');
    });
  });

  describe('updateTemplate', () => {
    it('should update a template', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          data: {
            id: mockTemplateId,
            template_name: 'Updated Template',
            version: 2,
          },
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await updateTemplate(mockAccessToken, mockTemplateId, {
        template_name: 'Updated Template',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(mockTemplateId),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            template_name: 'Updated Template',
          }),
        })
      );

      expect(result.template_name).toBe('Updated Template');
    });

    it('should send If-Match header for concurrency control', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { id: mockTemplateId },
        }),
      });

      await updateTemplate(
        mockAccessToken,
        mockTemplateId,
        { template_name: 'Updated' },
        '2026-04-14T10:00:00Z'
      );

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['If-Match']).toBe('2026-04-14T10:00:00Z');
    });

    it('should handle conflict error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 412,
      });

      await expect(
        updateTemplate(mockAccessToken, mockTemplateId, {
          template_name: 'Updated',
        })
      ).rejects.toThrow('CONFLICT: Template was modified by another user');
    });
  });

  describe('deleteTemplate', () => {
    it('should delete a template', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
      });

      await deleteTemplate(mockAccessToken, mockTemplateId);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(mockTemplateId),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('should handle delete error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(
        deleteTemplate(mockAccessToken, mockTemplateId)
      ).rejects.toThrow('Failed to delete template');
    });
  });

  describe('cloneTemplate', () => {
    it('should clone a template', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            id: 'cloned-id',
            template_code: 'TPL-CLONE',
            template_name: 'Cloned Template',
          },
        }),
      });

      const result = await cloneTemplate(
        mockAccessToken,
        mockTemplateId,
        'Cloned Template',
        'TPL-CLONE'
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`${mockTemplateId}/clone`),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            template_name: 'Cloned Template',
            template_code: 'TPL-CLONE',
          }),
        })
      );

      expect(result.template_code).toBe('TPL-CLONE');
    });
  });

  describe('bulkDeleteTemplates', () => {
    it('should bulk delete templates', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: 2,
          failed: 1,
          errors: [{ id: 'id-3', error: 'Template has active versions' }],
        }),
      });

      const result = await bulkDeleteTemplates(mockAccessToken, [
        'id-1',
        'id-2',
        'id-3',
      ]);

      expect(result.success).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('bulkUpdateTemplateStatus', () => {
    it('should bulk update template status', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: 3,
          failed: 0,
          errors: [],
        }),
      });

      const result = await bulkUpdateTemplateStatus(
        mockAccessToken,
        ['id-1', 'id-2', 'id-3'],
        'archived',
        'Quarterly cleanup'
      );

      expect(result.success).toBe(3);
      expect(result.failed).toBe(0);
    });
  });

  describe('fetchAircraftModels', () => {
    it('should fetch aircraft models', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: '1', name: 'Airbus A320', code: 'A320' },
            { id: '2', name: 'Boeing 737', code: 'B737' },
          ],
        }),
      });

      const result = await fetchAircraftModels(mockAccessToken);

      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('A320');
    });

    it('should handle fetch error gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
      });

      const result = await fetchAircraftModels(mockAccessToken);
      expect(result).toEqual([]);
    });
  });
});

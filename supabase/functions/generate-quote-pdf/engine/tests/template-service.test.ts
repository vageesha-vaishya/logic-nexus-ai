import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTemplate } from '../template-service';

describe('template-service getTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null without template id and skips querying', async () => {
    const from = vi.fn();
    const result = await getTemplate({ from } as any);
    expect(result).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it('loads template, normalizes content, and serves cached values', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'tpl-cache-1',
        template_name: 'MGL Main',
        name: 'Legacy Name',
        tenant_id: 'tenant-1',
        is_active: true,
        content: JSON.stringify({ sections: [{ id: 'summary' }] }),
        rate_options: [{ id: 'opt-1' }],
        transport_modes: ['ocean'],
        legs_config: [{ sequence: 1 }],
        carrier_selections: ['carrier-1'],
      },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const logger = { info: vi.fn(), warn: vi.fn() };

    const first = await getTemplate({ from } as any, 'tpl-cache-1', logger);
    const second = await getTemplate({ from } as any, 'tpl-cache-1', logger);

    expect(first).toEqual(
      expect.objectContaining({
        id: 'tpl-cache-1',
        name: 'MGL Main',
        tenant_id: 'tenant-1',
        is_active: true,
        sections: [{ id: 'summary' }],
        rate_options: [{ id: 'opt-1' }],
      }),
    );
    expect(second).toEqual(first);
    expect(from).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Miss'));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Hit'));
  });

  it('falls back to empty content when template json is invalid', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'tpl-invalid-json',
        name: 'Broken JSON Template',
        tenant_id: 'tenant-2',
        is_active: true,
        content: '{broken-json',
      },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });

    const result = await getTemplate({ from } as any, 'tpl-invalid-json');
    expect(result).toEqual(
      expect.objectContaining({
        id: 'tpl-invalid-json',
        name: 'Broken JSON Template',
      }),
    );
    expect(Object.keys(result)).toEqual(expect.arrayContaining(['id', 'name', 'tenant_id', 'is_active']));
  });

  it('returns null and logs warning when query fails', async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'row not found' },
    });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const logger = { info: vi.fn(), warn: vi.fn() };

    const result = await getTemplate({ from } as any, 'tpl-missing', logger);
    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('row not found'));
  });
});

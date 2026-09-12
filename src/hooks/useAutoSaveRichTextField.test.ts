import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAutoSaveRichTextField } from './useAutoSaveRichTextField';

const sanitizeHtml = (html: string) => html;

describe('useAutoSaveRichTextField', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-saves after the debounce delay once the field is dirty', async () => {
    const save = vi.fn().mockResolvedValue('<p>saved</p>');
    const { result } = renderHook(() => useAutoSaveRichTextField({ save, sanitizeHtml, delayMs: 30000 }));

    act(() => {
      result.current.setHtmlFromInput('<p>draft</p>');
    });
    expect(save).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(30000);
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('<p>draft</p>');
    expect(result.current.html).toBe('<p>saved</p>');
    expect(result.current.isSaving).toBe(false);
  });

  it('restarts the debounce timer on every further edit instead of stacking saves', async () => {
    const save = vi.fn().mockResolvedValue('<p>saved</p>');
    const { result } = renderHook(() => useAutoSaveRichTextField({ save, sanitizeHtml, delayMs: 30000 }));

    act(() => {
      result.current.setHtmlFromInput('<p>draft 1</p>');
    });
    act(() => {
      vi.advanceTimersByTime(20000);
    });
    act(() => {
      result.current.setHtmlFromInput('<p>draft 2</p>');
    });
    act(() => {
      vi.advanceTimersByTime(20000);
    });
    expect(save).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(10000);
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('<p>draft 2</p>');
  });

  it('saves immediately via saveNow without waiting for the debounce', async () => {
    const save = vi.fn().mockResolvedValue('<p>saved</p>');
    const { result } = renderHook(() => useAutoSaveRichTextField({ save, sanitizeHtml, delayMs: 30000 }));

    act(() => {
      result.current.setHtmlFromInput('<p>draft</p>');
    });

    await act(async () => {
      await result.current.saveNow();
    });

    expect(save).toHaveBeenCalledWith('<p>draft</p>');
    expect(result.current.html).toBe('<p>saved</p>');
  });

  it('records a save error and leaves the field dirty for retry', async () => {
    const save = vi.fn().mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useAutoSaveRichTextField({ save, sanitizeHtml, delayMs: 30000 }));

    act(() => {
      result.current.setHtmlFromInput('<p>draft</p>');
    });

    await act(async () => {
      vi.advanceTimersByTime(30000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.saveError).toBe('network down');
    expect(result.current.isSaving).toBe(false);
    expect(result.current.html).toBe('<p>draft</p>');
  });

  it('setHtml loads a value from the server without marking the field dirty', async () => {
    const save = vi.fn();
    const { result } = renderHook(() => useAutoSaveRichTextField({ save, sanitizeHtml, delayMs: 30000 }));

    act(() => {
      result.current.setHtml('<p>loaded</p>');
    });
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(result.current.html).toBe('<p>loaded</p>');
    expect(save).not.toHaveBeenCalled();
  });

  it('applyCommand sanitizes the editor innerHTML and marks the field dirty', () => {
    const save = vi.fn();
    const sanitize = vi.fn((html: string) => html.replace(/<script.*?>.*?<\/script>/g, ''));
    const { result } = renderHook(() => useAutoSaveRichTextField({ save, sanitizeHtml: sanitize, delayMs: 30000 }));

    const editor = document.createElement('div');
    editor.innerHTML = '<b>bold</b><script>evil()</script>';
    editor.focus = vi.fn();
    Object.defineProperty(result.current.editorRef, 'current', { value: editor, writable: true });
    document.execCommand = vi.fn();

    act(() => {
      result.current.applyCommand('bold');
    });

    expect(editor.focus).toHaveBeenCalled();
    expect(document.execCommand).toHaveBeenCalledWith('bold');
    expect(sanitize).toHaveBeenCalledWith('<b>bold</b><script>evil()</script>');
    expect(result.current.html).toBe('<b>bold</b>');
  });
});

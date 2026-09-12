import { useCallback, useEffect, useRef, useState } from 'react';

export type RichTextCommand = 'bold' | 'italic' | 'underline' | 'insertUnorderedList' | 'insertOrderedList';

interface UseAutoSaveRichTextFieldOptions {
  /** Persists `html` and returns the sanitized value the server accepted. */
  save: (html: string) => Promise<string>;
  /** Applied to the editor's innerHTML after a formatting command runs. */
  sanitizeHtml: (html: string) => string;
  /** Debounce before an auto-save fires after the field goes dirty. Defaults to 30s. */
  delayMs?: number;
}

/**
 * Drives a single contentEditable rich-text field with debounced auto-save:
 * dirty tracking, a save-in-flight flag, the last error, and a ref that keeps
 * the DOM's innerHTML in sync with saved/loaded html without fighting the
 * user's own typing (the sync effect only touches the DOM when it drifts
 * from state, e.g. after a fetch or save response).
 */
export function useAutoSaveRichTextField({ save, sanitizeHtml, delayMs = 30000 }: UseAutoSaveRichTextFieldOptions) {
  const [html, setHtmlState] = useState('');
  const [dirty, setDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const autoSaveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== html) {
      editorRef.current.innerHTML = html;
    }
  }, [html]);

  const persist = useCallback(async (nextHtml: string) => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const savedHtml = await save(nextHtml);
      setHtmlState(savedHtml);
      setDirty(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Auto-save failed');
    } finally {
      setIsSaving(false);
    }
  }, [save]);

  useEffect(() => {
    if (!dirty) return;
    if (autoSaveTimeoutRef.current) {
      window.clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = window.setTimeout(() => {
      void persist(html);
    }, delayMs);
    return () => {
      if (autoSaveTimeoutRef.current) {
        window.clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [dirty, html, delayMs, persist]);

  /** Load a value from the server without marking the field dirty. */
  const setHtml = useCallback((nextHtml: string) => {
    setHtmlState(nextHtml);
    setDirty(false);
  }, []);

  /** Record a user edit (e.g. from an onInput handler); marks the field dirty. */
  const setHtmlFromInput = useCallback((nextHtml: string) => {
    setHtmlState(nextHtml);
    setDirty(true);
  }, []);

  const applyCommand = useCallback((command: RichTextCommand) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand(command);
    setHtmlFromInput(sanitizeHtml(editor.innerHTML));
  }, [sanitizeHtml, setHtmlFromInput]);

  const saveNow = useCallback(() => persist(html), [persist, html]);

  return {
    html,
    setHtml,
    setHtmlFromInput,
    applyCommand,
    saveNow,
    isSaving,
    saveError,
    editorRef,
  };
}

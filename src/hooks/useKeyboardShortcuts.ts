import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * A hook to register global keyboard shortcuts.
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      // Global shortcuts
      if (e.key === 'g' && e.altKey) {
        // Alt + G: Go to Dashboard
        navigate('/dashboard');
      }

      if (e.key === 'l' && e.altKey) {
        // Alt + L: Go to Leads
        navigate('/dashboard/leads');
      }

      if (e.key === 'q' && e.altKey) {
        // Alt + Q: Go to Quotes
        navigate('/dashboard/quotes');
      }

      if (e.key === 'i' && e.altKey) {
        // Alt + I: Go to Invoices
        navigate('/dashboard/finance/invoices');
      }

      if (e.key === 'n' && (e.metaKey || e.ctrlKey)) {
        // Cmd/Ctrl + N: New record (context dependent)
        const path = window.location.pathname;
        if (path.includes('/leads')) navigate('/dashboard/leads/new');
        else if (path.includes('/quotes')) navigate('/dashboard/quotes/new');
        else if (path.includes('/invoices')) navigate('/dashboard/finance/invoices/new');
        e.preventDefault();
      }

      if (e.key === '/' && !e.shiftKey) {
        // /: Focus search if available
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);
}

import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { H1 } from '@/components/ui/Heading';

interface EntityNewPageHeaderProps {
  title: string;
  subtitle: string;
  onBack: () => void;
  backLabel?: string;
}

/**
 * Header for in-app "New X" pages that live inside DashboardLayout (sidebar
 * and app header retained): a back arrow, the page title, and a one-line
 * subtitle. ActivityNew and OpportunityNew rendered this identically by
 * hand; this is the single copy.
 *
 * Not for Account/Contact New -- those use EntityCreatePageShell, a
 * deliberate full-screen focused form with no app chrome.
 */
export function EntityNewPageHeader({ title, subtitle, onBack, backLabel = 'Back' }: EntityNewPageHeaderProps) {
  return (
    <div className="flex items-center gap-4">
      <Button variant="ghost" size="icon" onClick={onBack} aria-label={backLabel}>
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div>
        <H1>{title}</H1>
        <p className="text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

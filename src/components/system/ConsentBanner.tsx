/**
 * ConsentBanner — DPDP Act 2023 consent modal
 *
 * Self-contained modal that appears on first login when the user has not
 * yet given explicit consent under India's Digital Personal Data Protection
 * Act 2023. Cannot be dismissed without consenting.
 */

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Checkbox,
} from '@/design-system';
import { DialogDescription } from '@/components/ui/dialog';
import { useConsent } from '@/hooks/useConsent';

// ── Component ─────────────────────────────────────────────────────────────────

export function ConsentBanner() {
  const { hasConsented, isLoading, giveConsent, userId } = useConsent();

  const [analyticsChecked, setAnalyticsChecked] = useState(false);
  const [marketingChecked, setMarketingChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState<'essential' | 'selected' | null>(null);

  const handleAcceptEssential = async () => {
    setIsSubmitting('essential');
    try {
      await giveConsent({ data_processing: true, marketing: false, analytics: false });
    } catch (err) {
      toast.error(`Could not save consent: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmitting(null);
    }
  };

  const handleAcceptSelected = async () => {
    setIsSubmitting('selected');
    try {
      await giveConsent({
        data_processing: true,
        marketing: marketingChecked,
        analytics: analyticsChecked,
      });
    } catch (err) {
      toast.error(`Could not save consent: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmitting(null);
    }
  };

  // Wait until both: user is identified AND the consent query has resolved
  const isOpen = Boolean(userId) && !isLoading && !hasConsented;

  return (
    <Dialog open={isOpen} onOpenChange={() => undefined}>
      <DialogContent
        className="sm:max-w-lg"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Data Processing Consent</DialogTitle>
          <DialogDescription>
            Logic Nexus AI processes your personal data to provide logistics, trading, and
            business management services. Under India's Digital Personal Data Protection Act
            2023 (DPDP), we need your explicit consent before processing your data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Essential data processing — required, locked */}
          <div className="flex items-start gap-3 rounded-md border p-3 bg-muted/40">
            <Checkbox
              id="consent-data-processing"
              checked={true}
              disabled={true}
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <label
                htmlFor="consent-data-processing"
                className="text-sm font-medium leading-none cursor-default"
              >
                Essential data processing
              </label>
              <p className="text-xs text-muted-foreground">
                Required for login, security, and core platform features. Cannot be disabled.
              </p>
            </div>
          </div>

          {/* Analytics — optional */}
          <div className="flex items-start gap-3 rounded-md border p-3">
            <Checkbox
              id="consent-analytics"
              checked={analyticsChecked}
              onCheckedChange={(checked) => setAnalyticsChecked(Boolean(checked))}
              disabled={isSubmitting !== null}
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <label
                htmlFor="consent-analytics"
                className="text-sm font-medium leading-none cursor-pointer"
              >
                Usage analytics
              </label>
              <p className="text-xs text-muted-foreground">
                Helps us improve the platform. Data is anonymised and never sold.
              </p>
            </div>
          </div>

          {/* Marketing — optional */}
          <div className="flex items-start gap-3 rounded-md border p-3">
            <Checkbox
              id="consent-marketing"
              checked={marketingChecked}
              onCheckedChange={(checked) => setMarketingChecked(Boolean(checked))}
              disabled={isSubmitting !== null}
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <label
                htmlFor="consent-marketing"
                className="text-sm font-medium leading-none cursor-pointer"
              >
                Product updates &amp; offers
              </label>
              <p className="text-xs text-muted-foreground">
                Occasional emails about new features and offers. Unsubscribe anytime.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={handleAcceptEssential}
            disabled={isSubmitting !== null}
            className="w-full sm:w-auto"
          >
            {isSubmitting === 'essential' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Accept Essential Only
          </Button>
          <Button
            onClick={handleAcceptSelected}
            disabled={isSubmitting !== null}
            className="w-full sm:w-auto"
          >
            {isSubmitting === 'selected' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Accept Selected
          </Button>
        </DialogFooter>

        <p className="text-xs text-muted-foreground text-center pt-1">
          You can withdraw non-essential consent at any time from Settings &rarr; Privacy.{' '}
          <a
            href="/privacy-policy"
            className="underline underline-offset-2 hover:text-foreground"
            target="_blank"
            rel="noopener noreferrer"
          >
            View our Privacy Policy.
          </a>
        </p>
      </DialogContent>
    </Dialog>
  );
}

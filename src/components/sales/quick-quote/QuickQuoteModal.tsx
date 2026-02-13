import { useState, lazy, Suspense } from 'react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const QuickQuoteModalContent = lazy(() => import('./QuickQuoteModalContent'));

interface QuickQuoteModalProps {
  children?: React.ReactNode;
  accountId?: string;
}

export function QuickQuoteModal({ children, accountId }: QuickQuoteModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || <Button>Quick Quote</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] w-[1600px] h-[95vh] flex flex-col p-0 gap-0">
        <Suspense fallback={
          <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <span className="ml-4 text-lg font-medium text-muted-foreground">Loading Quick Quote Module...</span>
          </div>
        }>
          {isOpen && <QuickQuoteModalContent accountId={accountId} onClose={() => setIsOpen(false)} />}
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}

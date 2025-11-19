import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MultiModalQuoteComposer } from "@/components/sales/MultiModalQuoteComposer";
import { ErrorBoundary } from "@/components/sales/composer/ErrorBoundary";

export default function MultiModalQuote() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const quoteId = searchParams.get('quoteId');
  const versionId = searchParams.get('versionId');
  const optionId = searchParams.get('optionId');

  if (!quoteId || !versionId) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Missing required parameters (quoteId, versionId)</p>
            <Button onClick={() => navigate('/dashboard/quotes')} className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Quotes
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <ErrorBoundary>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>

          <MultiModalQuoteComposer
            quoteId={quoteId}
            versionId={versionId}
            optionId={optionId || undefined}
          />
        </div>
      </ErrorBoundary>
    </DashboardLayout>
  );
}

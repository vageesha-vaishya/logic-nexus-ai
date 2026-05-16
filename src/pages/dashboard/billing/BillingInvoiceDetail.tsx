import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button, Card, CardContent } from "@/design-system";
import { InvoicePDF } from "@/features/billing/components/InvoicePDF";
import { useInvoiceDetail } from "@/features/billing/hooks/useBilling";
import { useCRM } from "@/hooks/useCRM";

export default function BillingInvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { context } = useCRM();

  const { data, isLoading, isError, error } = useInvoiceDetail(id ?? null);
  const invoice = data?.invoice;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {isError && (
          <Card>
            <CardContent className="py-12 text-center text-destructive">
              {(error as Error)?.message ?? "Invoice not found"}
            </CardContent>
          </Card>
        )}

        {invoice && (
          <InvoicePDF
            invoice={invoice}
            tenantName={context.tenantName ?? "Your Organisation"}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

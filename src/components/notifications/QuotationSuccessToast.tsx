import { toast } from "sonner";
import { CheckCircle, X, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export const showQuotationSuccessToast = (quotationNumber: string) => {
  toast.custom(
    (t) => (
      <div
        className="w-full max-w-md bg-background border border-border rounded-lg shadow-lg p-4 flex items-start gap-3 pointer-events-auto"
        role="alert"
        aria-live="polite"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            toast.dismiss(t);
          }
        }}
        tabIndex={0} // Make it focusable for keyboard users
      >
        <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold text-sm">
            Quotation Created Successfully
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Quotation #{quotationNumber} has been successfully created.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 h-8 gap-2"
            onClick={() => {
              navigator.clipboard.writeText(quotationNumber);
              toast.success("Copied to clipboard");
            }}
            aria-label={`Copy quotation number ${quotationNumber} to clipboard`}
          >
            <Copy className="w-3.5 h-3.5" />
            Copy Number
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 -mt-1 -mr-1 text-muted-foreground hover:text-foreground"
          onClick={() => toast.dismiss(t)}
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    ),
    {
      duration: 5000, // > 3 seconds as requested
      position: "top-right",
    }
  );
};

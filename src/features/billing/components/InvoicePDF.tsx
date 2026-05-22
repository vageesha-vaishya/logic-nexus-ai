/**
 * InvoicePDF — GST-compliant invoice renderer + PDF download.
 *
 * Renders a printable HTML invoice and exports it as PDF via the
 * browser's native print-to-PDF (no jsPDF dependency needed).
 *
 * GST compliance:
 *  - SAC code 998314 (Software as a Service)
 *  - CGST 9% + SGST 9% for intra-state (same state)
 *  - IGST 18% for inter-state / B2B cross-state
 *  - Shows GSTIN of seller and buyer (if B2B)
 */

import { useRef } from "react";
import { format } from "date-fns";
import { Download, Printer } from "lucide-react";
import { Button } from "@/design-system";
import type { BillingInvoice } from "../hooks/useBilling";

interface InvoicePDFProps {
  invoice: BillingInvoice;
  tenantName: string;
}

function formatINR(amount: number | string): string {
  return Number(amount).toLocaleString("en-IN", {
    style: "currency", currency: "INR", minimumFractionDigits: 2,
  });
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  try { return format(new Date(d), "dd MMM yyyy"); } catch { return d; }
}

export function InvoicePDF({ invoice, tenantName }: InvoicePDFProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const isB2B    = Boolean(invoice.gstin_buyer);
  const subtotal = Number(invoice.subtotal_inr);
  const gst      = Number(invoice.gst_amount);
  const total    = Number(invoice.total_inr);

  // Intra-state: CGST + SGST; inter-state / B2B: IGST
  const igst  = isB2B;   // simplified: B2B = IGST, B2C = CGST+SGST
  const gst18 = invoice.gst_rate ?? 18;

  const handlePrint = () => {
    const content = printRef.current?.innerHTML ?? "";
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head>
      <title>Invoice ${invoice.invoice_number}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #111; background: #fff; padding: 32px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px 12px; text-align: left; border: 1px solid #e5e7eb; }
        th { background: #f9fafb; font-weight: 600; }
        .right { text-align: right; }
        .bold { font-weight: 700; }
        .header { display: flex; justify-content: space-between; margin-bottom: 32px; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; }
        .paid { background: #dcfce7; color: #15803d; }
        .issued { background: #dbeafe; color: #1d4ed8; }
        .section { margin-bottom: 24px; }
        .divider { border-top: 2px solid #e5e7eb; margin: 16px 0; }
        .total-row td { font-weight: 700; background: #f9fafb; }
        .footer { margin-top: 40px; font-size: 11px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 16px; }
        @media print { body { padding: 16px; } }
      </style>
    </head><body>${content}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
        </Button>
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Download className="mr-2 h-4 w-4" /> Download PDF
        </Button>
      </div>

      {/* Invoice HTML — printed as PDF */}
      <div ref={printRef} className="hidden">
        {/* Header */}
        <div className="header">
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#1e40af" }}>SOS Services</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
              {invoice.seller_name ?? "SOS Services Pvt. Ltd."}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              {invoice.seller_address ?? "India"}
            </div>
            {invoice.seller_gstin && (
              <div style={{ fontSize: 12, marginTop: 4 }}>
                <strong>GSTIN:</strong> {invoice.seller_gstin}
              </div>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>TAX INVOICE</div>
            <div style={{ fontSize: 14, marginTop: 6 }}>
              <strong>{invoice.invoice_number}</strong>
            </div>
            <div style={{ marginTop: 4 }}>
              <span className={`badge ${invoice.status === "paid" ? "paid" : "issued"}`}>
                {invoice.status.toUpperCase()}
              </span>
            </div>
            <div style={{ fontSize: 12, marginTop: 6, color: "#6b7280" }}>
              Issued: {fmtDate(invoice.issued_at)}
            </div>
            {invoice.paid_at && (
              <div style={{ fontSize: 12, color: "#6b7280" }}>Paid: {fmtDate(invoice.paid_at)}</div>
            )}
          </div>
        </div>

        {/* Bill To */}
        <div className="section" style={{ display: "flex", gap: 32, marginBottom: 24 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Bill To</div>
            <div style={{ fontWeight: 700 }}>{tenantName}</div>
            {invoice.gstin_buyer && (
              <div style={{ fontSize: 12 }}><strong>GSTIN:</strong> {invoice.gstin_buyer}</div>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Service Period</div>
            <div style={{ fontSize: 12 }}>
              {fmtDate(invoice.period_start)} — {fmtDate(invoice.period_end)}
            </div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              <strong>SAC Code:</strong> {invoice.sac_code ?? "998314"}
            </div>
            <div style={{ fontSize: 12 }}>
              <strong>Place of Supply:</strong> India
            </div>
          </div>
        </div>

        {/* Line items */}
        <table style={{ marginBottom: 16 }}>
          <thead>
            <tr>
              <th style={{ width: "50%" }}>Description</th>
              <th style={{ textAlign: "center" }}>SAC</th>
              <th style={{ textAlign: "center" }}>Qty</th>
              <th className="right">Unit Price</th>
              <th className="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.line_items ?? []).map((item, i) => (
              <tr key={i}>
                <td>{item.description}</td>
                <td style={{ textAlign: "center" }}>{item.sac_code}</td>
                <td style={{ textAlign: "center" }}>{item.quantity}</td>
                <td className="right">{formatINR(item.unit_price)}</td>
                <td className="right">{formatINR(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <table style={{ width: "320px", marginLeft: "auto", marginBottom: 16 }}>
          <tbody>
            <tr>
              <td>Subtotal</td>
              <td className="right">{formatINR(subtotal)}</td>
            </tr>
            {igst ? (
              <tr>
                <td>IGST @ {gst18}%</td>
                <td className="right">{formatINR(gst)}</td>
              </tr>
            ) : (
              <>
                <tr>
                  <td>CGST @ {gst18 / 2}%</td>
                  <td className="right">{formatINR(gst / 2)}</td>
                </tr>
                <tr>
                  <td>SGST @ {gst18 / 2}%</td>
                  <td className="right">{formatINR(gst / 2)}</td>
                </tr>
              </>
            )}
            <tr className="total-row">
              <td className="bold">Total (INR)</td>
              <td className="right bold">{formatINR(total)}</td>
            </tr>
          </tbody>
        </table>

        {/* Amount in words */}
        <div style={{ fontSize: 12, color: "#374151", marginBottom: 24 }}>
          <strong>Amount in Words:</strong> {amountInWords(total)} Only
        </div>

        <div className="divider" />

        {/* Footer */}
        <div className="footer">
          <div><strong>Note:</strong> This is a computer-generated invoice and is valid without signature.</div>
          <div style={{ marginTop: 8 }}>
            GST is applicable as per Indian tax laws. SAC code 998314 — Software as a Service (SaaS).
          </div>
          {isB2B && (
            <div style={{ marginTop: 4 }}>
              For B2B invoices: IGST @ {gst18}% applied as place of supply differs from seller state.
            </div>
          )}
        </div>
      </div>

      {/* Screen preview */}
      <div className="rounded-lg border bg-white p-8 text-sm shadow-sm">
        <div className="flex justify-between items-start mb-8">
          <div>
            <div className="text-xl font-bold text-blue-700">SOS Services</div>
            <div className="text-xs text-muted-foreground mt-1">
              {invoice.seller_name ?? "SOS Services Pvt. Ltd."}
            </div>
            {invoice.seller_gstin && (
              <div className="text-xs mt-1">GSTIN: {invoice.seller_gstin}</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-lg font-bold">TAX INVOICE</div>
            <div className="font-mono text-sm">{invoice.invoice_number}</div>
            <div className="mt-1">
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                invoice.status === "paid" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
              }`}>
                {invoice.status.toUpperCase()}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Issued: {fmtDate(invoice.issued_at)}
            </div>
          </div>
        </div>

        <div className="flex gap-12 mb-6">
          <div>
            <div className="font-semibold mb-1">Bill To</div>
            <div className="font-bold">{tenantName}</div>
            {invoice.gstin_buyer && <div className="text-xs">GSTIN: {invoice.gstin_buyer}</div>}
          </div>
          <div>
            <div className="font-semibold mb-1">Period</div>
            <div className="text-xs">{fmtDate(invoice.period_start)} — {fmtDate(invoice.period_end)}</div>
            <div className="text-xs mt-1">SAC: {invoice.sac_code ?? "998314"}</div>
          </div>
        </div>

        <table className="w-full border-collapse mb-4 text-xs">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left p-2 border">Description</th>
              <th className="text-center p-2 border">Qty</th>
              <th className="text-right p-2 border">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.line_items ?? []).map((item, i) => (
              <tr key={i}>
                <td className="p-2 border">{item.description}</td>
                <td className="text-center p-2 border">{item.quantity}</td>
                <td className="text-right p-2 border">{formatINR(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <table className="text-xs w-52">
            <tbody>
              <tr><td className="py-1">Subtotal</td><td className="text-right">{formatINR(subtotal)}</td></tr>
              {igst ? (
                <tr><td>IGST {gst18}%</td><td className="text-right">{formatINR(gst)}</td></tr>
              ) : (
                <>
                  <tr><td>CGST {gst18/2}%</td><td className="text-right">{formatINR(gst/2)}</td></tr>
                  <tr><td>SGST {gst18/2}%</td><td className="text-right">{formatINR(gst/2)}</td></tr>
                </>
              )}
              <tr className="font-bold border-t">
                <td className="pt-2">Total (INR)</td>
                <td className="text-right pt-2">{formatINR(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="text-xs text-muted-foreground mt-6 border-t pt-3">
          Computer-generated invoice. No signature required. GST @ 18% (SAC 998314 — SaaS).
        </div>
      </div>
    </div>
  );
}

// ── Amount in words ───────────────────────────────────────────────────────────

function amountInWords(n: number): string {
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
    "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function words(num: number): string {
    if (num === 0) return "";
    if (num < 20) return ones[num] + " ";
    if (num < 100) return tens[Math.floor(num/10)] + " " + ones[num % 10] + " ";
    if (num < 1000) return ones[Math.floor(num/100)] + " Hundred " + words(num % 100);
    if (num < 100000) return words(Math.floor(num/1000)) + "Thousand " + words(num % 1000);
    if (num < 10000000) return words(Math.floor(num/100000)) + "Lakh " + words(num % 100000);
    return words(Math.floor(num/10000000)) + "Crore " + words(num % 10000000);
  }
  const rupees = Math.floor(n);
  const paise  = Math.round((n - rupees) * 100);
  let result = "Rupees " + (words(rupees).trim() || "Zero");
  if (paise > 0) result += " and " + words(paise).trim() + " Paise";
  return result;
}

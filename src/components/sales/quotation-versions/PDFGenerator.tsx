import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

interface PDFGeneratorProps {
  versionId: string;
  versionNumber: number;
  quoteId: string;
}

export function PDFGenerator({ versionId, versionNumber, quoteId }: PDFGeneratorProps) {
  const [generating, setGenerating] = useState(false);

  const generatePDF = async () => {
    setGenerating(true);
    try {
      // Fetch version details with options
      const { data: version, error: vErr } = await supabase
        .from('quotation_versions')
        .select('*')
        .eq('id', versionId)
        .single();

      if (vErr) throw vErr;

      const { data: quote, error: qErr } = await supabase
        .from('quotes')
        .select('*, accounts(*)')
        .eq('id', quoteId)
        .single();

      if (qErr) throw qErr;

      const { data: options, error: oErr } = await supabase
        .from('quotation_version_options')
        .select(`
          *,
          carrier_rates(carrier_name, currency),
          quotation_version_option_legs(
            *,
            quote_charges(*)
          )
        `)
        .eq('quotation_version_id', versionId);

      if (oErr) throw oErr;

      // Generate PDF content
      const pdfContent = generatePDFContent(quote, version, options || []);
      
      // Create a simple HTML-based PDF using window.print
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(pdfContent);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
      }

      toast({
        title: 'PDF Generated',
        description: 'Quote PDF has been opened for printing',
      });
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate PDF',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const generatePDFContent = (quote: any, version: any, options: any[]) => {
    const account = quote.accounts || {};
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Quote #${quote.quote_number} - Version ${versionNumber}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 40px;
            color: #333;
          }
          .header {
            border-bottom: 3px solid #333;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            margin: 0;
            color: #2563eb;
          }
          .section {
            margin-bottom: 30px;
          }
          .section h2 {
            background: #f3f4f6;
            padding: 10px;
            margin: 0 0 15px 0;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .option {
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            page-break-inside: avoid;
          }
          .option-header {
            background: #3b82f6;
            color: white;
            padding: 10px 15px;
            margin: -20px -20px 20px -20px;
            border-radius: 6px 6px 0 0;
            font-size: 18px;
            font-weight: bold;
          }
          .pricing {
            background: #f9fafb;
            padding: 15px;
            border-radius: 6px;
            margin-top: 15px;
          }
          .pricing-row {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
          }
          .total {
            font-size: 20px;
            font-weight: bold;
            color: #2563eb;
            border-top: 2px solid #333;
            padding-top: 10px;
            margin-top: 10px;
          }
          @media print {
            body { margin: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Quotation</h1>
          <div style="display: flex; justify-content: space-between; margin-top: 10px;">
            <div>
              <strong>Quote #:</strong> ${quote.quote_number}<br>
              <strong>Version:</strong> ${versionNumber} (${version.kind})
            </div>
            <div style="text-align: right;">
              <strong>Date:</strong> ${new Date(version.created_at).toLocaleDateString()}<br>
              <strong>Status:</strong> ${version.status || 'Draft'}
            </div>
          </div>
        </div>

        <div class="section">
          <h2>Customer Information</h2>
          <div class="info-row">
            <span><strong>Company:</strong></span>
            <span>${account.name || 'N/A'}</span>
          </div>
          ${account.email ? `
          <div class="info-row">
            <span><strong>Email:</strong></span>
            <span>${account.email}</span>
          </div>` : ''}
          ${account.phone ? `
          <div class="info-row">
            <span><strong>Phone:</strong></span>
            <span>${account.phone}</span>
          </div>` : ''}
        </div>

        <div class="section">
          <h2>Shipment Information</h2>
          <div class="info-row">
            <span><strong>Status:</strong></span>
            <span>${version.status || 'Draft'}</span>
          </div>
          ${version.aes_hts_codes ? `
          <div class="info-row">
            <span><strong>HTS Code:</strong></span>
            <span>${version.aes_hts_codes.code} - ${version.aes_hts_codes.description}</span>
          </div>` : ''}
          ${version.incoterms ? `
          <div class="info-row">
            <span><strong>Incoterms:</strong></span>
            <span>${version.incoterms}</span>
          </div>` : ''}
          ${version.commodity ? `
          <div class="info-row">
            <span><strong>Commodity:</strong></span>
            <span>${version.commodity}</span>
          </div>` : ''}
          ${version.total_weight ? `
          <div class="info-row">
            <span><strong>Total Weight:</strong></span>
            <span>${version.total_weight} kg</span>
          </div>` : ''}
          ${version.total_volume ? `
          <div class="info-row">
            <span><strong>Total Volume:</strong></span>
            <span>${version.total_volume} m³</span>
          </div>` : ''}
        </div>

        <div class="section">
          <h2>Quote Options</h2>
          ${options.map((option, index) => `
            <div class="option">
              <div class="option-header">
                Option ${String.fromCharCode(65 + index)}: ${option.option_name || option.carrier_rates?.carrier_name || 'Unknown'}
              </div>
              
              <div class="pricing">
                ${option.total_buy !== null ? `
                <div class="pricing-row">
                  <span>Cost:</span>
                  <span>${option.carrier_rates?.currency || 'USD'} ${Number(option.total_buy).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>` : ''}
                
                <div class="pricing-row total">
                  <span>Total Price:</span>
                  <span>${option.carrier_rates?.currency || 'USD'} ${Number(option.total_sell || option.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                
                ${option.margin_amount !== null ? `
                <div class="pricing-row" style="color: #059669; font-weight: 600;">
                  <span>Margin:</span>
                  <span>${option.carrier_rates?.currency || 'USD'} ${Number(option.margin_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} (${Number(option.margin_percentage).toFixed(1)}%)</span>
                </div>` : ''}
                
                ${option.transit_time_days ? `
                <div class="pricing-row">
                  <span>Transit Time:</span>
                  <span>${option.transit_time_days} days</span>
                </div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>

        <div class="section">
          <p style="font-size: 12px; color: #6b7280; margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
            This quotation is valid for 30 days from the date of issue. Terms and conditions apply.
          </p>
        </div>
      </body>
      </html>
    `;
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={generatePDF}
      disabled={generating}
    >
      {generating ? (
        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
      ) : (
        <FileText className="w-4 h-4 mr-1" />
      )}
      Generate PDF
    </Button>
  );
}

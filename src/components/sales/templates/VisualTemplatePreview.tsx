import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface VisualTemplatePreviewProps {
  template: any;
  className?: string;
}

export function VisualTemplatePreview({ template, className }: VisualTemplatePreviewProps) {
  const sections = Array.isArray(template?.sections) ? template.sections : [];
  const config = template?.config || {};
  const margins = config.margins || { top: 40, bottom: 40, left: 40, right: 40 };

  // Helper to resolve dynamic values (mock)
  const resolve = (text: string) => {
    if (!text) return '';
    return text
      .replace(/{{quote.number}}/g, 'QUO-2024-001')
      .replace(/{{customer.name}}/g, 'Acme Corp')
      .replace(/{{quote.date}}/g, '2024-02-12')
      .replace(/{{quote.expiry}}/g, '2024-03-12');
  };

  const renderSection = (section: any, index: number) => {
    switch (section.type) {
      case 'header':
        return (
          <div key={index} className="mb-4 border-b pb-2">
            <h1 className="text-2xl font-bold">{resolve(section.content?.text || 'Quotation')}</h1>
            <div className="flex justify-between text-sm text-muted-foreground mt-2">
              <div>
                <p>Quote #: {resolve('{{quote.number}}')}</p>
                <p>Date: {resolve('{{quote.date}}')}</p>
              </div>
              <div className="text-right">
                <p>Valid Until: {resolve('{{quote.expiry}}')}</p>
              </div>
            </div>
          </div>
        );
      case 'footer':
        return (
          <div key={index} className="mt-8 pt-4 border-t text-center text-xs text-muted-foreground">
             {resolve(section.content?.text || 'Thank you for your business.')}
          </div>
        );
      case 'static_block':
        return (
          <div key={index} className="mb-4 text-sm whitespace-pre-wrap">
            {resolve(section.content?.text || '')}
          </div>
        );
      case 'dynamic_table':
        const columns = section.table_config?.columns || [];
        return (
          <div key={index} className="mb-4">
             <h3 className="text-sm font-semibold mb-2 bg-muted p-1">{section.title || 'Table'}</h3>
             <div className="border rounded-sm overflow-hidden">
                <div className="grid bg-muted/50 text-xs font-medium p-2" style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}>
                  {columns.map((col: any, i: number) => (
                    <div key={i} className={col.align === 'right' ? 'text-right' : ''}>{col.label}</div>
                  ))}
                </div>
                {/* Mock Row 1 */}
                <div className="grid text-xs p-2 border-t" style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}>
                  {columns.map((col: any, i: number) => (
                     <div key={i} className={col.align === 'right' ? 'text-right' : ''}>
                        {col.field.includes('amount') ? '$1,200.00' : 'Sample Data'}
                     </div>
                  ))}
                </div>
                {/* Mock Row 2 */}
                <div className="grid text-xs p-2 border-t" style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}>
                   {columns.map((col: any, i: number) => (
                     <div key={i} className={col.align === 'right' ? 'text-right' : ''}>
                        {col.field.includes('amount') ? '$450.00' : 'Sample Data'}
                     </div>
                  ))}
                </div>
             </div>
             {section.table_config?.show_subtotals && (
               <div className="text-right text-xs font-bold mt-2 pr-2">
                 Total: $1,650.00
               </div>
             )}
          </div>
        );
      default:
        return (
          <div key={index} className="mb-4 p-2 border border-dashed rounded text-xs text-muted-foreground">
            [{section.type}] {section.title}
          </div>
        );
    }
  };

  return (
    <div className={`bg-muted/30 p-4 rounded-lg h-full overflow-hidden flex flex-col ${className}`}>
      <div className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex justify-between items-center">
        <span>Live Preview (Approximation)</span>
        <span className="text-[10px] bg-background border px-1 rounded">A4</span>
      </div>
      <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 p-4 rounded border shadow-inner">
         <div 
           className="bg-white text-black shadow-lg mx-auto min-h-[842px] w-[595px] relative transition-all origin-top scale-[0.6] sm:scale-[0.7] md:scale-[0.8]"
           style={{
             paddingTop: margins.top,
             paddingBottom: margins.bottom,
             paddingLeft: margins.left,
             paddingRight: margins.right,
           }}
         >
            {sections.map((section: any, idx: number) => renderSection(section, idx))}
         </div>
      </div>
    </div>
  );
}

import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download } from 'lucide-react';

interface TemplateLibraryModalProps {
  onSelect: (template: any) => void;
}

const PRESET_TEMPLATES = [
  {
    id: 'standard-freight',
    name: 'Standard Freight Quote',
    description: 'A clean, professional layout suitable for general freight forwarding.',
    content: {
      name: 'Standard Freight Quote',
      config: { page_size: 'A4', font_family: 'Roboto' },
      sections: [
        { type: 'header', content: { text: 'QUOTATION' }, height: 100 },
        { type: 'static_block', content: { text: 'Dear {{customer.name}},\n\nThank you for your inquiry. We are pleased to offer the following rates:' } },
        { 
          type: 'dynamic_table', 
          title: 'Freight Charges',
          table_config: { 
             source: 'charges', 
             columns: [
               { field: 'description', label: 'Description', width: '40%' },
               { field: 'unit_price', label: 'Rate', format: 'currency', align: 'right' },
               { field: 'quantity', label: 'Qty', align: 'center' },
               { field: 'amount', label: 'Amount', format: 'currency', align: 'right' }
             ],
             show_subtotals: true
          }
        },
        { type: 'terms', title: 'Terms & Conditions' },
        { type: 'footer', content: { text: 'Page {{page_number}} of {{total_pages}}' } }
      ]
    }
  },
  {
    id: 'mgl-matrix',
    name: 'MGL Matrix Style',
    description: 'Complex layout with rates matrix, specifically designed for Miami Global Lines.',
    content: {
      name: 'MGL Matrix Style',
      config: { page_size: 'Letter', font_family: 'Helvetica' },
      sections: [
        { type: 'header', content: { text: 'QUOTATION' }, height: 150 },
        { type: 'customer_matrix_header', title: 'Customer Details' },
        { type: 'shipment_matrix_details', title: 'Shipment Information' },
        { type: 'rates_matrix', title: 'Freight Rates Matrix' },
        { type: 'terms', title: 'Standard Trading Conditions' },
        { type: 'footer', content: { text: 'MGL - Professional Attitude at all Altitudes' } }
      ]
    }
  },
  {
    id: 'simple-letter',
    name: 'Simple Letter',
    description: 'Text-heavy format for formal proposal letters.',
    content: {
        name: 'Simple Letter',
        config: { page_size: 'Letter', font_family: 'Times New Roman' },
        sections: [
            { type: 'header', content: { text: 'PROPOSAL' } },
            { type: 'static_block', content: { text: 'To: {{customer.name}}\nDate: {{quote.date}}\n\nSubject: Rate Proposal\n\n...' } },
            { type: 'footer', content: { text: 'Confidential' } }
        ]
    }
  }
];

export function TemplateLibraryModal({ onSelect }: TemplateLibraryModalProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (template: any) => {
    onSelect(template.content);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
           <Download className="h-4 w-4" /> Load from Library
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Template Library</DialogTitle>
          <DialogDescription>
            Choose a starting point from our collection of industry-standard templates.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[500px] pr-4">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              {PRESET_TEMPLATES.map((tpl) => (
                <Card key={tpl.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => handleSelect(tpl)}>
                   <CardHeader>
                     <CardTitle className="text-base">{tpl.name}</CardTitle>
                     <CardDescription>{tpl.description}</CardDescription>
                   </CardHeader>
                   <CardContent>
                      <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                         {tpl.content.sections.length} Sections • {tpl.content.config.page_size}
                      </div>
                   </CardContent>
                </Card>
              ))}
           </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

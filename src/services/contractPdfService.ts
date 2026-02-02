import jsPDF from 'jspdf';
import { VendorContract, Vendor } from '@/types/vendor';

export interface Clause {
  id: string;
  name: string;
  content: string;
  category?: string;
}

export const generateContractPDF = (
  contract: VendorContract,
  vendorName: string,
  clauses: Clause[]
) => {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.text('CONTRACT AGREEMENT', 105, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 190, 10, { align: 'right' });
  
  // Contract Meta
  doc.setFontSize(12);
  doc.text(`Contract #: ${contract.contract_number || 'PENDING'}`, 20, 40);
  doc.text(`Date: ${new Date(contract.start_date).toLocaleDateString()}`, 150, 40);
  
  // Parties Section
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('BETWEEN:', 20, 55);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Logic Nexus AI', 20, 65);
  doc.setFontSize(10);
  doc.text('123 Innovation Dr, Tech City', 20, 70);
  doc.text('(The "Company")', 20, 75);

  doc.setFontSize(12);
  doc.text('AND', 100, 65, { align: 'center' });

  doc.text(vendorName, 120, 65);
  doc.setFontSize(10);
  doc.text('(The "Vendor")', 120, 75);
  
  // Contract Details Box
  doc.setDrawColor(200);
  doc.rect(20, 85, 170, 35);
  
  doc.setFontSize(11);
  doc.text(`Type: ${contract.type.replace('_', ' ').toUpperCase()}`, 25, 95);
  doc.text(`Term: ${contract.start_date} to ${contract.end_date || 'Indefinite'}`, 25, 105);
  if (contract.value) {
    doc.text(`Value: ${contract.currency || 'USD'} ${contract.value.toLocaleString()}`, 25, 115);
  }

  // Clauses
  let yPos = 140;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TERMS AND CONDITIONS', 105, yPos, { align: 'center' });
  yPos += 15;
  
  if (clauses.length === 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'italic');
    doc.text('(No specific clauses selected)', 20, yPos);
    yPos += 20;
  } else {
    clauses.forEach((clause, index) => {
        // Page break check
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`${index + 1}. ${clause.name}`, 20, yPos);
        yPos += 7;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const splitText = doc.splitTextToSize(clause.content, 170);
        doc.text(splitText, 20, yPos);
        yPos += (splitText.length * 5) + 10;
    });
  }
  
  // Signatures
  if (yPos > 220) {
    doc.addPage();
    yPos = 40;
  } else {
    yPos += 30;
  }
  
  doc.setDrawColor(0);
  doc.line(20, yPos, 80, yPos);
  doc.line(120, yPos, 180, yPos);
  
  doc.setFontSize(10);
  doc.text('Authorized Signature', 20, yPos + 5);
  doc.text('Logic Nexus AI', 20, yPos + 10);
  
  doc.text('Authorized Signature', 120, yPos + 5);
  doc.text(vendorName, 120, yPos + 10);
  
  return doc;
};

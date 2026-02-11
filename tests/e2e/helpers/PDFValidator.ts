
import { PDFDocument } from 'pdf-lib';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfParseLib = require('pdf-parse');

export class PDFValidator {
    static async validate(base64Content: string): Promise<{ isValid: boolean; pageCount: number; text: string; error?: string }> {
        try {
            const buffer = Buffer.from(base64Content, 'base64');
            const pdfDoc = await PDFDocument.load(buffer);
            const pageCount = pdfDoc.getPageCount();
            
            // Extract text for validation
            let text = '';
            try {
                // Handle pdf-parse v2+ class-based API
                const PDFParse = pdfParseLib.PDFParse || pdfParseLib.default?.PDFParse;
                if (PDFParse) {
                    const parser = new PDFParse({ data: buffer });
                    const result = await parser.getText();
                    text = result.text;
                } else if (typeof pdfParseLib === 'function') {
                     // Fallback to v1 function-based API
                     const result = await pdfParseLib(buffer);
                     text = result.text;
                } else {
                     console.warn('Unknown pdf-parse structure', pdfParseLib);
                }
            } catch (e) {
                console.warn('Text extraction failed:', e);
            }
            
            return {
                isValid: pageCount > 0,
                pageCount,
                text
            };
        } catch (error) {
            console.log('PDF Validation Error:', error);
            return { isValid: false, pageCount: 0, text: '' };
        }
    }
}

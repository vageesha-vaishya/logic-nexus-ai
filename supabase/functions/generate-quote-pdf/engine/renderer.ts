import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { QuoteTemplate, TemplateSection } from "./schema.ts";
import { SafeContext } from "./context.ts";
import { I18nEngine } from "./i18n.ts";
import { Logger } from "../../_shared/logger.ts";

export class PdfRenderer {
  private doc: PDFDocument | null = null;
  private font: PDFFont | null = null;
  private boldFont: PDFFont | null = null;
  private template: QuoteTemplate;
  private context: SafeContext;
  private i18n: I18nEngine;
  private logger: Logger;
  private cursorY: number = 0;
  private currentPage: PDFPage | null = null;
  private margins: { top: number; bottom: number; left: number; right: number };

  constructor(template: QuoteTemplate, context: SafeContext, logger: Logger) {
    this.template = template;
    this.context = context;
    this.logger = logger;
    this.i18n = new I18nEngine(template, logger);
    this.margins = template.config.margins;
  }

  async init() {
    this.doc = await PDFDocument.create();
    this.font = await this.doc.embedFont(StandardFonts.Helvetica);
    this.boldFont = await this.doc.embedFont(StandardFonts.HelveticaBold);
    
    this.addNewPage();
  }

  private addNewPage() {
    if (!this.doc) throw new Error("Document not initialized");
    
    const page = this.doc.addPage();
    this.currentPage = page;
    const { height } = page.getSize();
    this.cursorY = height - this.margins.top;
  }

  async render(): Promise<Uint8Array> {
    if (!this.doc) await this.init();

    this.setMetadata();

    for (let i = 0; i < this.template.sections.length; i++) {
        await this.renderSection(this.template.sections[i], i);
    }

    if (!this.doc) throw new Error("Render failed");
    return await this.doc.save();
  }

  private setMetadata() {
    if (!this.doc) return;
    this.doc.setTitle(`Quotation ${this.context.quote.number || 'Draft'}`);
    this.doc.setAuthor(this.context.branding.company_name || 'Nexus System');
    this.doc.setSubject('Freight Quotation');
    this.doc.setKeywords(['quotation', 'logistics', 'freight', this.context.quote.number || '']);
    this.doc.setProducer('Nexus Quotation Engine V2');
    this.doc.setCreator('Nexus Quotation Engine V2');
    this.doc.setCreationDate(new Date());
    this.doc.setModificationDate(new Date());
    // Audit Compliance: Set Language
    this.doc.setLanguage(this.context.meta.locale || 'en-US');
  }

  private async renderSection(section: TemplateSection, index: number) {
    try {
        if (section.page_break_before) {
          this.addNewPage();
        }

        // Check if we have enough space for the section header/content
        // For now, simple check. 
        if (this.cursorY < this.margins.bottom + 50) {
           this.addNewPage();
        }

        switch (section.type) {
          case "header":
            await this.renderHeader(section);
            break;
          case "static_block":
            await this.renderStaticBlock(section);
            break;
          case "dynamic_table":
            await this.renderDynamicTable(section);
            break;
          case "footer":
            await this.renderFooter(section);
            break;
          default:
            this.logger.warn(`Unsupported section type: ${section.type}`);
        }

        // Update Cursor
        if (section.height) {
           // If fixed height, deduct it. 
           // Note: dynamic tables handle their own cursor movement.
           if (section.type !== "dynamic_table") {
              this.cursorY -= section.height;
           }
        } else {
          this.cursorY -= 20; 
        }
    } catch (e) {
        this.logger.error(`Error rendering section #${index} (${section.type}):`, { error: e });
        // Resilience: Draw error placeholder instead of crashing entire PDF
        this.drawErrorBox(index, section.type, e instanceof Error ? e.message : String(e));
        this.cursorY -= 50;
    }
  }

  private drawErrorBox(index: number, type: string, errorMsg: string) {
      if (!this.currentPage || !this.font) return;
      const x = this.margins.left;
      const width = this.currentPage.getSize().width - this.margins.left - this.margins.right;
      
      this.drawRect(x, this.cursorY - 40, width, 40, rgb(1, 0, 0));
      this.currentPage.drawText(`Error rendering section #${index} [${type}]`, {
          x: x + 5,
          y: this.cursorY - 15,
          size: 10,
          font: this.font,
          color: rgb(1, 0, 0)
      });
      this.currentPage.drawText(errorMsg, {
          x: x + 5,
          y: this.cursorY - 30,
          size: 8,
          font: this.font,
          color: rgb(0.5, 0.5, 0.5)
      });
  }

  private async renderHeader(section: TemplateSection) {
    if (!this.currentPage || !this.font || !this.boldFont) return;
    
    const { width, height } = this.currentPage.getSize();
    
    // Dynamic Colors & Text
    const primaryColor = this.hexToRgb(this.context.branding.primary_color || "#0087b5");
    const companyName = this.context.branding.company_name || "MIAMI GLOBAL LINES";
    const logoText = companyName.length > 10 ? companyName.substring(0, 3).toUpperCase() : companyName;

    // MGL Layout Check
    if (this.template.name.includes("MGL")) {
        // MGL Logo Text (Centered)
        // Try to render logo image first
        const logoW = 150;
        const logoH = 60;
        const logoX = (width - logoW) / 2;
        const logoY = height - 20;

        const logoRendered = await this.renderLogo(logoX, logoY, logoW, logoH);
        
        if (!logoRendered) {
             this.drawTextCentered(logoText, height - 40, 30, true, primaryColor);
        }

        this.drawTextCentered(companyName.toUpperCase(), height - 60, 16, true, primaryColor);

        // Address
        const addrY = height - 85;
        this.drawTextCentered("140 Ethel Road West; Unit 'S&T', Piscataway, NJ 08854-USA", addrY, 10, true);
        this.drawTextCentered("Phone:+1-732-640-2365,FMC Lic. # 023172NF / IAC #: NE1210010", addrY - 12, 10, true);
        this.drawTextCentered("Professional Attitude at all Altitudes", addrY - 24, 10, true, rgb(0, 0, 0));

        this.cursorY = addrY - 50;

        // Quote Box
        const y = this.cursorY;
        this.drawRect(40, y - 20, 180, 20);
        this.currentPage.drawText("QUOTE", { x: 45, y: y - 14, size: 9, font: this.boldFont });
        this.currentPage.drawText(this.context.quote.number, { x: 120, y: y - 14, size: 9, font: this.font });

        // Valid Till Box
        this.drawRect(370, y - 20, 180, 20);
        this.currentPage.drawText("Valid Till", { x: 375, y: y - 14, size: 9, font: this.boldFont });
        
        let expiryDate = "N/A";
        if (this.context.quote.expiry) {
             // Audit Compliance: Use i18n formatter
             expiryDate = this.i18n.formatDate(this.context.quote.expiry, this.context.meta.locale);
        }
        this.currentPage.drawText(expiryDate, { x: 470, y: y - 14, size: 9, font: this.font });

        this.cursorY -= 40;
    } else {
        // Fallback Header
        const logoRendered = await this.renderLogo(this.margins.left, this.cursorY, 200, 50);

        if (logoRendered) {
             this.cursorY -= (logoRendered.height + 10);
        } else {
             const text = section.content?.text || "QUOTATION";
             this.currentPage.drawText(text, {
                 x: this.margins.left,
                 y: this.cursorY - 20,
                 size: 20,
                 font: this.boldFont,
                 color: rgb(0, 0, 0),
             });
             this.cursorY -= 40;
        }
    }
  }

  private async renderStaticBlock(section: TemplateSection) {
    if (!this.currentPage || !this.font || !section.content) return;
    
    const text = section.content.text || "";
    const fontSize = section.content.style?.fontSize || 12;
    const isBold = section.content.style?.fontWeight === "bold";

    this.currentPage.drawText(text, {
      x: this.margins.left,
      y: this.cursorY - fontSize,
      size: fontSize,
      font: isBold && this.boldFont ? this.boldFont : this.font,
      color: rgb(0, 0, 0),
    });
  }

  private async renderDynamicTable(section: TemplateSection) {
    if (!this.currentPage || !this.font || !section.table_config) return;
    if (!this.boldFont) return;

    const config = section.table_config;
    // @ts-ignore
    const data = this.context[config.source] as any[];
    if (!Array.isArray(data)) return;

    const { width } = this.currentPage.getSize();
    const tableWidth = width - this.margins.left - this.margins.right;
    
    // Parse column widths
    const cols = config.columns.map(col => {
        let colW = 0;
        if (typeof col.width === 'string' && col.width.endsWith('%')) {
            const pct = parseFloat(col.width) / 100;
            colW = tableWidth * pct;
        } else {
            colW = Number(col.width) || (tableWidth / config.columns.length);
        }
        return { ...col, pixelWidth: colW };
    });

    const rowHeight = 20;
    const headerHeight = 25;

    // Draw Header
    let x = this.margins.left;
    const secondaryColor = this.hexToRgb(this.context.branding.secondary_color || "#dceef2");
    this.drawRect(x, this.cursorY - headerHeight, tableWidth, headerHeight, secondaryColor, true); // Header BG
    
    for (const col of cols) {
        this.currentPage.drawText(col.label, {
            x: x + 5, // padding
            y: this.cursorY - 18,
            size: 10,
            font: this.boldFont,
            color: rgb(0, 0, 0)
        });
        x += col.pixelWidth;
    }
    
    this.cursorY -= headerHeight;

    // Draw Rows
    for (const row of data) {
        // Check pagination
        if (this.cursorY < this.margins.bottom + rowHeight) {
            this.addNewPage();
            this.cursorY -= 20; // margin
            // Redraw Header? Maybe later
        }

        x = this.margins.left;
        this.drawRect(x, this.cursorY - rowHeight, tableWidth, rowHeight); // Border

        for (const col of cols) {
            let val = this.getDynamicField(row, col.field);
            
            if (col.format === 'currency') {
                val = this.i18n.formatCurrency(
                  Number(val),
                  this.context.quote.currency,
                  this.context.meta.locale
                );
            }
            
            val = String(val ?? '');
            
            // Align
            let textX = x + 5;
            const textWidth = this.font.widthOfTextAtSize(val, 9);
            if (col.align === 'right') textX = x + col.pixelWidth - textWidth - 5;
            if (col.align === 'center') textX = x + (col.pixelWidth - textWidth) / 2;

            this.currentPage.drawText(val, {
                x: textX,
                y: this.cursorY - 14,
                size: 9,
                font: this.font,
                color: rgb(0, 0, 0)
            });
            
            // Draw vertical line
            this.drawLine(x + col.pixelWidth, this.cursorY, x + col.pixelWidth, this.cursorY - rowHeight);
            
            x += col.pixelWidth;
        }
        
        this.cursorY -= rowHeight;
    }
    
    // Total Row if enabled
    if (config.show_subtotals) {
        const total = data.reduce(
          (sum, item) => sum + (Number(this.getDynamicField(item, "amount")) || 0),
          0
        );
        this.cursorY -= 5;
        
        this.currentPage.drawText(`Total: ${total.toFixed(2)}`, {
            x: this.margins.left + tableWidth - 100,
            y: this.cursorY - 14,
            size: 10,
            font: this.boldFont,
            color: rgb(0, 0, 0)
        });
        this.cursorY -= 20;
    }
  }
  
  private async renderFooter(section: TemplateSection) {
     if (!this.currentPage || !this.font) return;
     const text = section.content?.text || "";
     const { width } = this.currentPage.getSize();
     
     const textWidth = this.font.widthOfTextAtSize(text, 10);
     const x = (width - textWidth) / 2;
     
     this.currentPage.drawText(text, {
         x,
         y: this.margins.bottom,
         size: 10,
         font: this.font,
         color: rgb(0.5, 0.5, 0.5)
     });
  }

  private async renderLogo(x: number, y: number, maxWidth: number, maxHeight: number) {
     if (!this.currentPage || !this.doc) return null;
     const { logo_base64 } = this.context.branding;
     
     if (!logo_base64) return null;

     try {
        const cleanBase64 = logo_base64.split(',')[1] || logo_base64;
        const imageBytes = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));
        
        // Try PNG first, then JPG
        let image;
        try {
            image = await this.doc.embedPng(imageBytes);
        } catch {
            image = await this.doc.embedJpg(imageBytes);
        }

        const dims = image.scaleToFit(maxWidth, maxHeight);
        
        // Center the image in the box defined by x, y, maxWidth, maxHeight?
        // Or just draw at x, y (top-left)? 
        // pdf-lib drawImage y is bottom-left. 
        // Let's assume x, y is the top-left corner of the area we want to draw in.
        
        this.currentPage.drawImage(image, {
             x: x,
             y: y - dims.height,
             width: dims.width,
             height: dims.height,
        });
              return dims;
           } catch (e) {
               this.logger.warn("Failed to render logo", { error: e });
               return null;
           }
        }

  // Helpers
  private getDynamicField(row: any, field: string): any {
    if (!row) return "";
    if (field in row) return row[field];
    if (field === "description") return row.description ?? row.desc;
    if (field === "amount") return row.amount ?? row.total;
    if (field === "currency") return row.currency ?? row.curr;
    if (field === "quantity") return row.quantity ?? row.qty;
    if (field === "carrier") return row.carrier ?? row.carrier_name;
    if (field === "carrier_name") return row.carrier_name ?? row.carrier;
    return row[field];
  }

  private hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return rgb(0, 0, 0); 
    return rgb(
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
    );
  }

  private drawTextCentered(text: string, y: number, size: number, isBold: boolean, color: any = rgb(0,0,0)) {
     if (!this.currentPage || !this.font || !this.boldFont) return;
     const font = isBold ? this.boldFont : this.font;
     const { width } = this.currentPage.getSize();
     const textWidth = font.widthOfTextAtSize(text, size);
     this.currentPage.drawText(text, {
         x: (width - textWidth) / 2,
         y,
         size,
         font,
         color
     });
  }

  private drawRect(x: number, y: number, w: number, h: number, color = rgb(0,0,0), filled = false) {
     if (!this.currentPage) return;
     if (filled) {
         this.currentPage.drawRectangle({ x, y, width: w, height: h, color });
     } else {
         this.currentPage.drawRectangle({ x, y, width: w, height: h, borderColor: color, borderWidth: 1 });
     }
  }

  private drawLine(x1: number, y1: number, x2: number, y2: number, color = rgb(0,0,0)) {
     if (!this.currentPage) return;
     this.currentPage.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, color, thickness: 1 });
  }
}

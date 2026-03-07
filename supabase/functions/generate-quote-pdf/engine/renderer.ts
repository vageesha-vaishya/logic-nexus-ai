import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { QuoteTemplate, TemplateSection } from "./schema.ts";
import { SafeContext } from "./context.ts";
import { I18nEngine } from "./i18n.ts";
import { Logger } from "../../_shared/logger.ts";
import { groupOptionsForMatrix } from "./matrix-helper.ts";

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
          case "terms_block":
            await this.renderTermsBlock(section);
            break;
          case "multi_rate_summary":
            await this.renderMultiRateSummary(section);
            break;
          case "multi_modal_details":
            await this.renderMultiModalDetails(section);
            break;
          case "matrix_rate_table":
            await this.renderMatrixRateTable(section);
            break;
          case "key_value_grid":
            await this.renderKeyValueGrid(section);
            break;
          case "detailed_matrix_rate_table":
            await this.renderDetailedMatrixRateTable(section);
            break;
          default:
            this.logger.warn(`Unsupported section type: ${section.type}`);
        }

        // Update Cursor
        if (section.height) {
           // If fixed height, deduct it. 
           // Note: dynamic tables handle their own cursor movement.
           const dynamicSections = [
               "dynamic_table", 
               "matrix_rate_table", 
               "detailed_matrix_rate_table", 
               "key_value_grid", 
               "multi_rate_summary",
               "multi_modal_details"
           ];
           
           if (!dynamicSections.includes(section.type)) {
              this.cursorY -= section.height;
           }
        } else {
          // If no height specified, default spacing (unless dynamic and moved already?)
          // For dynamic sections, they usually leave cursor at the end of content.
          // We might want a small buffer.
          if (!["dynamic_table", "matrix_rate_table", "detailed_matrix_rate_table", "key_value_grid", "multi_rate_summary", "multi_modal_details"].includes(section.type)) {
              this.cursorY -= 20;
          }
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

  private async renderMultiRateSummary(section: TemplateSection) {
     if (!this.currentPage || !this.font || !this.boldFont) return;

     let optionsToRender = this.context.options || [];
     
     // Fallback to static options from template config if no dynamic options are present
     if (optionsToRender.length === 0 && section.config?.options && section.config.options.length > 0) {
         // Map static options to the expected format
         optionsToRender = section.config.options.map((opt: any, index: number) => ({
             id: opt.id || `static-${index}`,
             grand_total: opt.total_amount || opt.grand_total || 0,
             legs: opt.legs || [],
             charges: opt.charges || opt.items || [], 
         }));
     }

     // Only render if we have multiple options to compare
     if (optionsToRender.length <= 1) {
         // Even if single option, check if we need to show breakdown
         if (section.config?.showBreakdown && optionsToRender.length === 1) {
             await this.renderRateBreakdown(optionsToRender[0], section);
         }
         return;
     }

     const title = section.content?.text || "Rate Options Summary";
     
     // Draw Title
     this.currentPage.drawText(title, {
         x: this.margins.left,
         y: this.cursorY - 5,
         size: 14,
         font: this.boldFont,
         color: rgb(0, 0, 0)
     });
     
     this.cursorY -= 30;

     // Table Setup
     const headers = ["Option", "Carrier / Service", "Transit Time", "Total Amount"];
     // A4 width ~595. Margins 40. Usable ~515.
     // distribute: 15%, 40%, 25%, 20%
     const tableWidth = this.currentPage.getSize().width - this.margins.left - this.margins.right;
     const colWidths = [
         tableWidth * 0.15, 
         tableWidth * 0.40, 
         tableWidth * 0.25, 
         tableWidth * 0.20
     ];
     
     const rowHeight = 25;
     const headerHeight = 25;

     // Header
     let x = this.margins.left;
     const secondaryColor = this.hexToRgb(this.context.branding.secondary_color || "#dceef2");
     this.drawRect(x, this.cursorY - headerHeight, tableWidth, headerHeight, secondaryColor, true);

     headers.forEach((h, i) => {
         this.currentPage!.drawText(h, {
             x: x + 5,
             y: this.cursorY - 18,
             size: 10,
             font: this.boldFont!,
             color: rgb(0, 0, 0)
         });
         x += colWidths[i];
     });

     this.cursorY -= headerHeight;

     // Rows
     for (const [index, opt] of optionsToRender.entries()) {
         if (this.cursorY < this.margins.bottom + rowHeight) {
             this.addNewPage();
             this.cursorY -= 20;
             // Redraw Header? skipping for simplicity in summary
         }

         x = this.margins.left;
         this.drawRect(x, this.cursorY - rowHeight, tableWidth, rowHeight); // Border

         // Data Extraction
         const optionName = `Option ${index + 1}`;
         // Try to find main carrier from legs
               const mainLeg = opt.legs.find((l: any) => 
                   (l.mode === 'ocean' || l.mode === 'air') || 
                   (l.transport_mode === 'ocean' || l.transport_mode === 'air')
               ) || opt.legs[0];
               
               const carrier = mainLeg?.carrier_name || "Multi-Carrier";
         const transit = opt.legs.map((l: any) => l.transit_time).filter(Boolean).join(" + ") || "N/A";
         const total = this.i18n.formatCurrency(opt.grand_total, this.context.quote.currency, this.context.meta.locale);

         const rowData = [optionName, carrier, transit, total];

         rowData.forEach((val, i) => {
             // Alignment
             let textX = x + 5;
             const textWidth = this.font!.widthOfTextAtSize(val, 9);
             
             // Right align amount
             if (i === 3) textX = x + colWidths[i] - textWidth - 5;
             
             this.currentPage!.drawText(val, {
                 x: textX,
                 y: this.cursorY - 16,
                 size: 9,
                 font: this.font!,
                 color: rgb(0, 0, 0)
             });
             
             // Vertical line to the right of this cell
             this.drawLine(x + colWidths[i], this.cursorY, x + colWidths[i], this.cursorY - rowHeight);
             
             x += colWidths[i];
         });

         this.cursorY -= rowHeight;
     }

     this.cursorY -= 20;

     // Render Breakdown if enabled
     if (section.config?.showBreakdown) {
         for (const [index, opt] of optionsToRender.entries()) {
             await this.renderRateBreakdown(opt, section, index + 1);
         }
     }
  }

  private async renderRateBreakdown(option: any, section: TemplateSection, optionIndex: number = 1) {
      if (!this.currentPage || !this.font || !this.boldFont) return;
      
      const charges = option.charges || option.items || [];
      if (charges.length === 0) return;

      if (this.cursorY < this.margins.bottom + 60) {
          this.addNewPage();
          this.cursorY -= 20;
      }

      // Title
      const title = `Option ${optionIndex} Charges`;
      this.currentPage.drawText(title, {
          x: this.margins.left,
          y: this.cursorY - 5,
          size: 11,
          font: this.boldFont,
          color: this.hexToRgb(this.context.branding.primary_color || "#0087b5")
      });
      this.cursorY -= 25;

      // Table Headers
      const headers = ["Description", "Qty", "Unit Price", "Amount"];
      const tableWidth = this.currentPage.getSize().width - this.margins.left - this.margins.right;
      // 40%, 15%, 20%, 25%
      const colWidths = [
          tableWidth * 0.40,
          tableWidth * 0.15,
          tableWidth * 0.20,
          tableWidth * 0.25
      ];
      const rowHeight = 20;
      const headerHeight = 20;

      // Header BG
      let x = this.margins.left;
      const secondaryColor = this.hexToRgb(this.context.branding.secondary_color || "#dceef2");
      this.drawRect(x, this.cursorY - headerHeight, tableWidth, headerHeight, secondaryColor, true);

      headers.forEach((h, i) => {
           let textX = x + 5;
           // Align right for numeric columns
           if (i > 0) {
               // roughly center headers for numeric
               const tw = this.boldFont!.widthOfTextAtSize(h, 9);
               textX = x + (colWidths[i] - tw) / 2; 
               if (i === 3) textX = x + colWidths[i] - tw - 5; // right align amount
           }

           this.currentPage!.drawText(h, {
               x: textX,
               y: this.cursorY - 14,
               size: 9,
               font: this.boldFont!,
               color: rgb(0, 0, 0)
           });
           x += colWidths[i];
      });
      this.cursorY -= headerHeight;

      // Rows
      for (const charge of charges) {
          if (this.cursorY < this.margins.bottom + rowHeight) {
              this.addNewPage();
              this.cursorY -= 20;
          }
          
          x = this.margins.left;
          // light border
          this.drawRect(x, this.cursorY - rowHeight, tableWidth, rowHeight, rgb(0.9, 0.9, 0.9));

          const desc = charge.description || charge.name || "Charge";
          const qty = String(charge.quantity || charge.qty || 1);
          const price = this.i18n.formatCurrency(charge.unit_price || charge.rate || 0, this.context.quote.currency, this.context.meta.locale);
          const total = this.i18n.formatCurrency(charge.amount || charge.total || 0, this.context.quote.currency, this.context.meta.locale);

          const rowData = [desc, qty, price, total];

          rowData.forEach((val, i) => {
               let textX = x + 5;
               const textWidth = this.font!.widthOfTextAtSize(val, 9);

               if (i === 0) {
                   // left align desc
               } else if (i === 3) {
                   // right align total
                   textX = x + colWidths[i] - textWidth - 5;
               } else {
                   // center qty/price
                   textX = x + (colWidths[i] - textWidth) / 2;
               }

               this.currentPage!.drawText(val, {
                   x: textX,
                   y: this.cursorY - 14,
                   size: 9,
                   font: this.font!,
                   color: rgb(0, 0, 0)
               });
               x += colWidths[i];
          });
          this.cursorY -= rowHeight;
      }
      this.cursorY -= 15;
  }

  private async renderMultiModalDetails(section: TemplateSection) {
    if (!this.currentPage || !this.font || !this.boldFont) return;
    
    // Config Check: Skip if explicitly hidden
    if (section.config?.showLegs === false) return;

    const title = section.content?.text || "Transport Details";
    
    // Draw Section Title
    this.currentPage.drawText(title, {
         x: this.margins.left,
         y: this.cursorY - 5,
         size: 14,
         font: this.boldFont,
         color: rgb(0, 0, 0)
    });
    this.cursorY -= 30;

    let optionsToRender = this.context.options && this.context.options.length > 0 
        ? this.context.options 
        : [{ id: 'default', legs: this.context.legs || [], grand_total: this.context.quote.grand_total }];

    // Check if dynamic legs exist (any option has legs)
    const hasDynamicLegs = optionsToRender.some((o: any) => o.legs && o.legs.length > 0);

    // Fallback to static legs from template config if no dynamic legs are present
    if (!hasDynamicLegs && section.config?.legs && section.config.legs.length > 0) {
        optionsToRender = [{ 
            id: 'static', 
            legs: section.config.legs, 
            grand_total: 0 
        }];
    }

    for (const [index, opt] of optionsToRender.entries()) {
        // Option Header (only if multiple options)
        if (this.context.options && this.context.options.length > 1) {
            if (this.cursorY < this.margins.bottom + 40) {
                 this.addNewPage();
                 this.cursorY -= 20;
            }

            const optTitle = `Option ${index + 1}: ${this.i18n.formatCurrency(opt.grand_total || 0, this.context.quote.currency, this.context.meta.locale)}`;
            this.currentPage.drawText(optTitle, {
                x: this.margins.left,
                y: this.cursorY - 12,
                size: 12,
                font: this.boldFont,
                color: this.hexToRgb(this.context.branding.primary_color || "#0087b5")
            });
            this.cursorY -= 25;
        }

        // Render Legs Table
        const legs = opt.legs || [];
        if (legs.length === 0) continue;
        
        const headers = ["Mode", "Origin", "Destination", "Carrier", "Transit Time"];
        // Distribute widths: 15%, 25%, 25%, 20%, 15%
        const tableWidth = this.currentPage.getSize().width - this.margins.left - this.margins.right;
        const colWidths = [
            tableWidth * 0.15, 
            tableWidth * 0.25, 
            tableWidth * 0.25, 
            tableWidth * 0.20,
            tableWidth * 0.15
        ];
        
        const rowHeight = 20;
        const headerHeight = 25;

        // Header
        if (this.cursorY < this.margins.bottom + headerHeight + rowHeight) {
            this.addNewPage();
            this.cursorY -= 20;
        }

        let x = this.margins.left;
        const secondaryColor = this.hexToRgb(this.context.branding.secondary_color || "#dceef2");
        this.drawRect(x, this.cursorY - headerHeight, tableWidth, headerHeight, secondaryColor, true);

        headers.forEach((h, i) => {
           this.currentPage!.drawText(h, {
               x: x + 5,
               y: this.cursorY - 18,
               size: 10,
               font: this.boldFont!,
               color: rgb(0, 0, 0)
           });
           x += colWidths[i];
        });
        this.cursorY -= headerHeight;

        // Rows
        for (const leg of legs) {
            if (this.cursorY < this.margins.bottom + rowHeight) {
                this.addNewPage();
                this.cursorY -= 20;
                this.drawLine(this.margins.left, this.cursorY, this.margins.left + tableWidth, this.cursorY);
            }

            x = this.margins.left;
            // Border
            this.drawRect(x, this.cursorY - rowHeight, tableWidth, rowHeight); 

            const rowData = [
                (leg.mode || leg.transport_mode || "N/A").toUpperCase(),
                leg.pol || leg.origin || "",
                leg.pod || leg.destination || "",
                leg.carrier_name || leg.carrier || "",
                leg.transit_time || ""
            ];

            rowData.forEach((val, i) => {
               const text = String(val || "");
               // Simple truncation
               // const maxWidth = colWidths[i] - 10;
               // ... truncation logic omitted for brevity
               
               this.currentPage!.drawText(text, {
                   x: x + 5,
                   y: this.cursorY - 14,
                   size: 9,
                   font: this.font!,
                   color: rgb(0, 0, 0)
               });
               
               // Vertical line
               this.drawLine(x + colWidths[i], this.cursorY, x + colWidths[i], this.cursorY - rowHeight);
               
               x += colWidths[i];
            });
            this.cursorY -= rowHeight;
        }
        this.cursorY -= 15; // Gap between options
    }
  }

  private async renderMatrixRateTable(section: TemplateSection) {
    if (!this.currentPage || !this.font || !this.boldFont) return;

    let optionsToRender = this.context.options || [];

    // Fallback
    if (optionsToRender.length === 0 && section.config?.options) {
         optionsToRender = section.config.options;
    }

    if (optionsToRender.length === 0) return;

    const title = section.content?.text || "Freight Rates";

    // Draw Title
    this.currentPage.drawText(title, {
         x: this.margins.left,
         y: this.cursorY - 5,
         size: 14,
         font: this.boldFont,
         color: rgb(0, 0, 0)
    });
    this.cursorY -= 30;

    // --- Matrix Grouping Logic ---
    // 1. Identify unique container sizes (Columns)
    const containerSizes = new Set<string>();
    optionsToRender.forEach((opt: any) => {
        if (opt.container_size && opt.container_size !== 'N/A') {
            containerSizes.add(opt.container_size);
        } else if (opt.container_type && opt.container_type !== 'N/A') {
             containerSizes.add(opt.container_type);
        } else {
             // If it's a valid option but no container size, we might label it based on something else
             // or just group it under "Other"
             containerSizes.add("Other");
        }
    });
    // Sort columns: Standard sizes first, then others
    const sortedContainers = Array.from(containerSizes).sort((a, b) => {
        // specific logic to put 20 before 40
        const getVal = (s: string) => {
            if (s.includes('20')) return 1;
            if (s.includes('40')) return 2;
            if (s.includes('45')) return 3;
            return 4;
        };
        const valA = getVal(a);
        const valB = getVal(b);
        if (valA !== valB) return valA - valB;
        return a.localeCompare(b);
    });

    // 2. Group options by Carrier + Transit Time (Rows)
    const rows = new Map<string, any>();
    
    optionsToRender.forEach((opt: any) => {
        const carrier = opt.carrier || "Multi-Carrier";
        const transit = opt.transit_time || "N/A";
        const key = `${carrier}|${transit}`;
        
        if (!rows.has(key)) {
            rows.set(key, {
                carrier,
                transit,
                prices: {}
            });
        }
        
        const row = rows.get(key);
        // Determine column for this option
        let colKey = "Other";
        if (opt.container_size && opt.container_size !== 'N/A') colKey = opt.container_size;
        else if (opt.container_type && opt.container_type !== 'N/A') colKey = opt.container_type;
        
        row.prices[colKey] = opt.grand_total;
    });

    const tableData = Array.from(rows.values());

    // --- Table Setup ---
    const fixedHeaders = ["Carrier", "Transit Time"];
    const headers = [...fixedHeaders, ...sortedContainers];
    
    const tableWidth = this.currentPage.getSize().width - this.margins.left - this.margins.right;
    
    // Width Calculation
    // Carrier: 30%, Transit: 20%, Rest distributed among containers
    const carrierWidth = tableWidth * 0.30;
    const transitWidth = tableWidth * 0.20;
    const remainingWidth = tableWidth - carrierWidth - transitWidth;
    const containerWidth = sortedContainers.length > 0 ? remainingWidth / sortedContainers.length : 0;
    
    const colWidths = [
         carrierWidth,
         transitWidth,
         ...sortedContainers.map(() => containerWidth)
    ];

    const rowHeight = 25;
    const headerHeight = 25;

    // Header
    let x = this.margins.left;
    const secondaryColor = this.hexToRgb(this.context.branding.secondary_color || "#dceef2");
    this.drawRect(x, this.cursorY - headerHeight, tableWidth, headerHeight, secondaryColor, true);

    headers.forEach((h, i) => {
         // Center align container headers
         let textX = x + 5;
         if (i >= fixedHeaders.length) {
             const tw = this.boldFont!.widthOfTextAtSize(h, 9);
             textX = x + (colWidths[i] - tw) / 2;
         }
         
         this.currentPage!.drawText(h, {
             x: textX,
             y: this.cursorY - 18,
             size: 9,
             font: this.boldFont!,
             color: rgb(0, 0, 0)
         });
         x += colWidths[i];
    });

    this.cursorY -= headerHeight;

    // Rows
    for (const row of tableData) {
         if (this.cursorY < this.margins.bottom + rowHeight) {
             this.addNewPage();
             this.cursorY -= 20;
             // Redraw Header
             this.drawRect(this.margins.left, this.cursorY - headerHeight, tableWidth, headerHeight, secondaryColor, true);
             let hx = this.margins.left;
             headers.forEach((h, i) => {
                 let textX = hx + 5;
                 if (i >= fixedHeaders.length) {
                     const tw = this.boldFont!.widthOfTextAtSize(h, 9);
                     textX = hx + (colWidths[i] - tw) / 2;
                 }
                 this.currentPage!.drawText(h, { x: textX, y: this.cursorY - 18, size: 9, font: this.boldFont!, color: rgb(0, 0, 0) });
                 hx += colWidths[i];
             });
             this.cursorY -= headerHeight;
         }

         x = this.margins.left;
         this.drawRect(x, this.cursorY - rowHeight, tableWidth, rowHeight); // Border

         // Render Carrier & Transit
         const carrierVal = row.carrier;
         const transitVal = row.transit;
         
         // Carrier
         this.currentPage!.drawText(carrierVal, {
             x: x + 5,
             y: this.cursorY - 16,
             size: 9,
             font: this.font!,
             color: rgb(0, 0, 0)
         });
         this.drawLine(x + colWidths[0], this.cursorY, x + colWidths[0], this.cursorY - rowHeight);
         x += colWidths[0];

         // Transit
         this.currentPage!.drawText(transitVal, {
             x: x + 5,
             y: this.cursorY - 16,
             size: 9,
             font: this.font!,
             color: rgb(0, 0, 0)
         });
         this.drawLine(x + colWidths[1], this.cursorY, x + colWidths[1], this.cursorY - rowHeight);
         x += colWidths[1];

         // Render Prices
         sortedContainers.forEach((container, idx) => {
             const price = row.prices[container];
             const val = price ? this.i18n.formatCurrency(price, this.context.quote.currency, this.context.meta.locale) : "-";
             
             // Center or Right align price
             const textWidth = this.font!.widthOfTextAtSize(val, 9);
             const textX = x + colWidths[2 + idx] - textWidth - 5;

             this.currentPage!.drawText(val, {
                 x: textX,
                 y: this.cursorY - 16,
                 size: 9,
                 font: this.font!,
                 color: rgb(0, 0, 0)
             });
             
             this.drawLine(x + colWidths[2 + idx], this.cursorY, x + colWidths[2 + idx], this.cursorY - rowHeight);
             x += colWidths[2 + idx];
         });

         this.cursorY -= rowHeight;
    }

    this.cursorY -= 20;
  }

  private async renderKeyValueGrid(section: TemplateSection) {
    if (!this.currentPage || !this.font || !this.boldFont || !section.grid_fields) return;

    const { width } = this.currentPage.getSize();
    const tableWidth = width - this.margins.left - this.margins.right;
    
    // Configurable columns count, default to 2
    const colsCount = section.config?.columns || 2;
    const colWidth = tableWidth / colsCount;
    const rowHeight = 20;

    let x = this.margins.left;
    let colIndex = 0;

    for (const field of section.grid_fields) {
        if (this.cursorY < this.margins.bottom + rowHeight) {
            this.addNewPage();
            this.cursorY -= 20;
            x = this.margins.left;
            colIndex = 0;
        }

        const label = field.label || field.key;
        let value = this.resolvePath(this.context, field.key);

        if (field.format === 'date' && value) {
             value = this.i18n.formatDate(value, this.context.meta.locale);
        } else if (field.format === 'currency' && value) {
             value = this.i18n.formatCurrency(Number(value), this.context.quote.currency, this.context.meta.locale);
        }

        value = String(value || '-');

        // Draw Label
        this.currentPage.drawText(label + ":", {
            x: x,
            y: this.cursorY,
            size: 9,
            font: this.boldFont,
            color: rgb(0.3, 0.3, 0.3)
        });

        // Draw Value
        const labelWidth = this.boldFont.widthOfTextAtSize(label + ":", 9);
        this.currentPage.drawText(value, {
            x: x + labelWidth + 5,
            y: this.cursorY,
            size: 9,
            font: this.font,
            color: rgb(0, 0, 0)
        });

        colIndex++;
        if (colIndex >= colsCount) {
            colIndex = 0;
            x = this.margins.left;
            this.cursorY -= rowHeight;
        } else {
            x += colWidth;
        }
    }
    
    // Ensure cursor moves down if we ended in the middle of a row
    if (colIndex !== 0) {
        this.cursorY -= rowHeight;
    }
    
    this.cursorY -= 10;
  }

  private resolvePath(obj: any, path: string): any {
    if (!obj || !path) return undefined;
    // Handle array access like legs[0].pol or customer.company_name
    // Split by dot or bracket
    const parts = path.replace(/\]/g, '').split(/[.\[]/);
    
    return parts.reduce((prev, curr) => {
        return prev && prev[curr] !== undefined ? prev[curr] : undefined;
    }, obj);
  }

  private async renderHeader(section: TemplateSection) {
    if (!this.currentPage || !this.font || !this.boldFont) return;
    
    const { width, height } = this.currentPage.getSize();
    
    // Dynamic Colors & Text
    const primaryColor = this.hexToRgb(this.context.branding.primary_color || "#0087b5");
    const companyName = this.context.branding.company_name || "MIAMI GLOBAL LINES";
    const companyAddress = this.context.branding.company_address || "140 Ethel Road West; Unit 'S&T', Piscataway, NJ 08854-USA";
    const subHeader = this.context.branding.sub_header_text || "Phone:+1-732-640-2365,FMC Lic. # 023172NF / IAC #: NE1210010";
    const headerText = this.context.branding.header_text || "Professional Attitude at all Altitudes";

    const logoText = companyName.length > 10 ? companyName.substring(0, 3).toUpperCase() : companyName;

    // Standard Layout (Logo + Centered Info)
    // We default to this layout if branding is present or if it's the MGL template
    if ((this.template.name && String(this.template.name).includes("MGL")) || this.context.branding?.logo_base64) {
        // Logo
        const logoW = 150;
        const logoH = 60;
        const logoX = (width - logoW) / 2;
        const logoY = height - 20;

        const logoRendered = await this.renderLogo(logoX, logoY, logoW, logoH);
        
        if (!logoRendered) {
             this.drawTextCentered(logoText, height - 40, 30, true, primaryColor);
             this.drawTextCentered(companyName.toUpperCase(), height - 60, 16, true, primaryColor);
        }

        // Address & Contact Info
        const addrY = height - 85;
        this.drawTextCentered(companyAddress, addrY, 10, true);
        this.drawTextCentered(subHeader, addrY - 12, 10, true);
        this.drawTextCentered(headerText, addrY - 24, 10, true, rgb(0, 0, 0));

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
     // Use dynamic footer text if available, else fallback to section content
     const text = this.context.branding.footer_text || section.content?.text || "";
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

  private async renderTermsBlock(section: TemplateSection) {
     if (!this.currentPage || !this.font) return;
     
     const title = "Notes and Terms";
     // Use dynamic disclaimer text if available, else fallback to section content
     const text = this.context.branding.disclaimer_text || section.content?.text || "Standard terms apply.";
     
     // Draw Title
     this.currentPage.drawText(title, {
         x: this.margins.left,
         y: this.cursorY - 12,
         size: 10,
         font: this.boldFont!,
         color: rgb(0, 0, 0)
     });
     
     this.cursorY -= 25;

     // Robust text wrapping logic
     const fontSize = 9;
     const lineHeight = fontSize + 4;
     const maxWidth = this.currentPage.getSize().width - this.margins.left - this.margins.right;
     
     const paragraphs = text.split('\n');
     
     for (const paragraph of paragraphs) {
         const lines = this.breakTextIntoLines(paragraph, fontSize, maxWidth);
         
         for (const line of lines) {
             if (this.cursorY < this.margins.bottom + 20) {
                 this.addNewPage();
                 this.cursorY -= 20;
             }
             
             this.currentPage.drawText(line, {
                 x: this.margins.left,
                 y: this.cursorY,
                 size: fontSize,
                 font: this.font,
                 color: rgb(0.2, 0.2, 0.2)
             });
             
             this.cursorY -= lineHeight;
         }
         // Add a small gap between paragraphs if desired, or just standard leading
         // this.cursorY -= 2; 
     }
     
     this.cursorY -= 20;
  }

  private breakTextIntoLines(text: string, fontSize: number, maxWidth: number): string[] {
      if (!this.font) return [text];
      
      const words = text.split(' ');
      const lines: string[] = [];
      let currentLine = words[0];

      for (let i = 1; i < words.length; i++) {
          const word = words[i];
          const width = this.font.widthOfTextAtSize(currentLine + " " + word, fontSize);
          if (width < maxWidth) {
              currentLine += " " + word;
          } else {
              lines.push(currentLine);
              currentLine = word;
          }
      }
      lines.push(currentLine);
      return lines;
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

  private async renderDetailedMatrixRateTable(section: TemplateSection) {
    if (!this.currentPage || !this.font || !this.boldFont) return;

    let optionsToRender = this.context.options || [];
    if (optionsToRender.length === 0 && section.config?.options) {
         optionsToRender = section.config.options;
    }
    if (optionsToRender.length === 0) return;

    const title = section.content?.text || "Freight Rates Breakdown";
    
    if (this.cursorY < this.margins.bottom + 50) this.addNewPage();
    
    this.currentPage.drawText(title, {
         x: this.margins.left,
         y: this.cursorY - 5,
         size: 14,
         font: this.boldFont,
         color: rgb(0, 0, 0)
    });
    this.cursorY -= 30;

    // Use helper to group options
    const groups = groupOptionsForMatrix(optionsToRender);

    const cyanColor = this.hexToRgb("#66c2cd"); // Cyan from screenshot approx

    for (const group of groups) {
        const opts = group.options;
        const sortedContainers = group.containerTypes;
        const chargeMap = group.chargeMap;
        const chargeNoteMap = group.chargeNoteMap;

        if (this.cursorY < this.margins.bottom + 100) {
             this.addNewPage();
             this.cursorY -= 20;
        }

        // Header Data
        const carrier = group.carrier;
        const transit = group.transit;
        const frequency = group.frequency;

        // Draw Header Bar (Cyan)
        const headerHeight = 25;
        const pageWidth = this.currentPage!.getSize().width;
        const tableWidth = pageWidth - this.margins.left - this.margins.right;
        
        this.drawRect(this.margins.left, this.cursorY - headerHeight, tableWidth, headerHeight, cyanColor, true);

        // Header Text
        const textY = this.cursorY - 18;
        this.currentPage!.drawText(`Carrier: ${carrier}`, {
            x: this.margins.left + 5,
            y: textY,
            size: 10,
            font: this.boldFont!,
            color: rgb(0,0,0)
        });

        this.currentPage!.drawText(`Transit Time: ${transit}`, {
            x: this.margins.left + (tableWidth * 0.4),
            y: textY,
            size: 10,
            font: this.boldFont!,
            color: rgb(0,0,0)
        });

        this.currentPage!.drawText(`Frequency: ${frequency}`, {
            x: this.margins.left + (tableWidth * 0.75),
            y: textY,
            size: 10,
            font: this.boldFont!,
            color: rgb(0,0,0)
        });

        this.cursorY -= headerHeight;

        // Routing / Legs Info
        const legs = group.routing;
        if (legs && legs.length > 0) {
             // Check if we have space
             if (this.cursorY < this.margins.bottom + (legs.length * 15) + 20) {
                 this.addNewPage();
                 this.cursorY -= 20;
             }

             const routingY = this.cursorY - 12;
             this.currentPage!.drawText("Routing:", {
                 x: this.margins.left + 5,
                 y: routingY,
                 size: 9,
                 font: this.boldFont!,
                 color: rgb(0,0,0)
             });
             
             let legY = routingY;
             legs.forEach((leg: any, idx: number) => {
                 const mode = leg.mode || leg.transport_mode || 'N/A';
                 const carrierName = leg.carrier || 'N/A';
                 const tTime = leg.transit_time ? `(${leg.transit_time})` : '';
                 const legText = `${idx + 1}. ${leg.pol || 'Origin'} -> ${leg.pod || 'Dest'} [${mode}] ${carrierName} ${tTime}`;
                 
                 legY -= 12;
                 this.currentPage!.drawText(legText, {
                     x: this.margins.left + 55,
                     y: legY,
                     size: 8,
                     font: this.font!,
                     color: rgb(0.2, 0.2, 0.2)
                 });
             });
             
             this.cursorY = legY - 15; // Space after routing
        }

        // Table Layout
        const firstColWidth = 120; // Charge Description
        const remarksColWidth = 100; // Remarks
        const availableWidth = tableWidth - firstColWidth - remarksColWidth;
        const colWidth = sortedContainers.length > 0 ? availableWidth / sortedContainers.length : 0;
        
        // Table Header Row
        const rowHeight = 20;
        
        // Column Headers
        let x = this.margins.left + firstColWidth;
        sortedContainers.forEach(h => {
             this.currentPage!.drawText(h, { x: x + 2, y: this.cursorY - 14, size: 9, font: this.boldFont!, color: rgb(0,0,0) });
             x += colWidth;
        });
        this.currentPage!.drawText("Remarks", { x: x + 2, y: this.cursorY - 14, size: 9, font: this.boldFont!, color: rgb(0,0,0) });
        
        // Bottom border of header row
        this.drawLine(this.margins.left, this.cursorY - rowHeight, this.margins.left + tableWidth, this.cursorY - rowHeight);
        this.cursorY -= rowHeight;

        // Rows
        for (const [desc, amounts] of chargeMap) {
            if (this.cursorY < this.margins.bottom + 20) {
                 this.addNewPage();
                 this.cursorY -= 20;
            }
            
            x = this.margins.left;
            this.currentPage!.drawText(desc, { x: x + 2, y: this.cursorY - 14, size: 9, font: this.font!, color: rgb(0,0,0) });
            x += firstColWidth;

            sortedContainers.forEach(ct => {
                const val = amounts.get(ct);
                const text = val ? val.toFixed(2) : ""; 
                this.currentPage!.drawText(text, { x: x + 2, y: this.cursorY - 14, size: 9, font: this.font!, color: rgb(0,0,0) });
                x += colWidth;
            });

            // Remarks
            const note = chargeNoteMap.get(desc) || "";
            if (note) {
                 this.currentPage!.drawText(note, { x: x + 2, y: this.cursorY - 14, size: 8, font: this.font!, color: rgb(0,0,0) });
            }
            
            // Horizontal Line
            this.drawLine(this.margins.left, this.cursorY - rowHeight, this.margins.left + tableWidth, this.cursorY - rowHeight);
            this.cursorY -= rowHeight;
        }

        // Total Row
        if (this.cursorY < this.margins.bottom + 20) {
             this.addNewPage();
             this.cursorY -= 20;
        }
        
        this.drawRect(this.margins.left, this.cursorY - rowHeight, tableWidth, rowHeight, cyanColor, true);
        
        x = this.margins.left;
        this.currentPage!.drawText("Total", { x: x + 2, y: this.cursorY - 14, size: 9, font: this.boldFont!, color: rgb(0,0,0) });
        x += firstColWidth;

        sortedContainers.forEach(ct => {
            const opt = opts.find((o: any) => (o.container_size || o.container_type || "Standard") === ct);
            const total = opt ? opt.grand_total : 0;
            const text = total.toFixed(2);
            this.currentPage!.drawText(text, { x: x + 2, y: this.cursorY - 14, size: 9, font: this.boldFont!, color: rgb(0,0,0) });
            x += colWidth;
        });

        this.currentPage!.drawText("All Inclusive rates from SD/Port basis", { 
            x: x + 2, 
            y: this.cursorY - 14, 
            size: 8, 
            font: this.font!, 
            color: rgb(0,0,0) 
        });

        this.cursorY -= (rowHeight + 20); // Spacing after table
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

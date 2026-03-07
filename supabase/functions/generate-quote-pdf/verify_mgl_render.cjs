
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');

class MockRenderer {
  constructor() {
    this.doc = null;
    this.font = null;
    this.boldFont = null;
    this.currentPage = null;
    this.margins = { top: 40, bottom: 40, left: 40, right: 40 };
    this.cursorY = 800;
    this.context = {
      options: [
        {
          id: "opt-1",
          carrier: "Maersk",
          transit_time: "25 Days",
          frequency: "Weekly",
          container_size: "20'",
          legs: [
            { mode: "Ocean", pol: "New York", pod: "Rotterdam", carrier: "Maersk", transit_time: "15 Days" },
            { mode: "Rail", pol: "Rotterdam", pod: "Berlin", carrier: "DB Cargo", transit_time: "10 Days" }
          ],
          grand_total: 2500,
          charges: [
            { description: "Ocean Freight", amount: 2000, note: "Includes BAF" },
            { description: "THC Origin", amount: 300 },
            { description: "Doc Fee", amount: 200 }
          ]
        },
        {
          id: "opt-2",
          carrier: "MSC",
          transit_time: "30 Days",
          frequency: "Weekly",
          container_size: "40'",
          legs: [
            { mode: "Ocean", pol: "New York", pod: "Antwerp", carrier: "MSC", transit_time: "18 Days" },
            { mode: "Truck", pol: "Antwerp", pod: "Brussels", carrier: "MSC Logistics", transit_time: "2 Days" }
          ],
          grand_total: 4500,
          charges: [
            { description: "Ocean Freight", amount: 4000 },
            { description: "THC Destination", amount: 500 }
          ]
        },
        {
          id: "opt-3",
          carrier: "Lufthansa",
          transit_time: "3 Days",
          frequency: "Daily",
          container_size: "N/A", // Air freight usually doesn't have container size like ocean
          container_type: "Air Standard",
          legs: [
             { mode: "Air", pol: "JFK", pod: "FRA", carrier: "Lufthansa", transit_time: "8 Hours" },
             { mode: "Truck", pol: "FRA", pod: "Munich", carrier: "Lufthansa Road", transit_time: "4 Hours" }
          ],
          grand_total: 1200,
          charges: [
            { description: "Air Freight", amount: 1000, note: "All in" },
            { description: "Fuel Surcharge", amount: 200 }
          ]
        }
      ]
    };
  }

  async init() {
    this.doc = await PDFDocument.create();
    this.font = await this.doc.embedFont(StandardFonts.Helvetica);
    this.boldFont = await this.doc.embedFont(StandardFonts.HelveticaBold);
    this.addNewPage();
  }

  addNewPage() {
    this.currentPage = this.doc.addPage();
    const { height } = this.currentPage.getSize();
    this.cursorY = height - this.margins.top;
  }

  drawRect(x, y, width, height, color = rgb(0, 0, 0), fill = false) {
    if (fill) {
      this.currentPage.drawRectangle({ x, y, width, height, color, borderOpacity: 0 });
    } else {
      this.currentPage.drawRectangle({ x, y, width, height, borderColor: color, borderWidth: 1, opacity: 0 });
    }
  }

  drawLine(x1, y1, x2, y2, color = rgb(0, 0, 0)) {
    this.currentPage.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, color, thickness: 1 });
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? rgb(
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
    ) : rgb(0, 0, 0);
  }

  async renderDetailedMatrixRateTable() {
    const section = { content: { text: "Freight Rates Breakdown" } };
    const title = section.content.text;
    
    if (this.cursorY < this.margins.bottom + 50) this.addNewPage();
    
    this.currentPage.drawText(title, {
         x: this.margins.left,
         y: this.cursorY - 5,
         size: 14,
         font: this.boldFont,
         color: rgb(0, 0, 0)
    });
    this.cursorY -= 30;

    // Group by Carrier
    const groups = new Map();
    this.context.options.forEach((opt) => {
        const carrier = opt.carrier || "Multi-Carrier";
        if (!groups.has(carrier)) groups.set(carrier, []);
        groups.get(carrier).push(opt);
    });

    const cyanColor = this.hexToRgb("#66c2cd"); 

    for (const [carrier, opts] of groups) {
        if (this.cursorY < this.margins.bottom + 100) {
             this.addNewPage();
             this.cursorY -= 20;
        }

        // Header Data
        const firstOpt = opts[0];
        const transit = firstOpt.transit_time || "N/A";
        const frequency = firstOpt.frequency || "N/A";

        // Draw Header Bar (Cyan)
        const headerHeight = 25;
        const pageWidth = this.currentPage.getSize().width;
        const tableWidth = pageWidth - this.margins.left - this.margins.right;
        
        this.drawRect(this.margins.left, this.cursorY - headerHeight, tableWidth, headerHeight, cyanColor, true);

        // Header Text
        const textY = this.cursorY - 18;
        this.currentPage.drawText(`Carrier: ${carrier}`, {
            x: this.margins.left + 5,
            y: textY,
            size: 10,
            font: this.boldFont,
            color: rgb(0,0,0)
        });

        this.currentPage.drawText(`Transit Time: ${transit}`, {
            x: this.margins.left + (tableWidth * 0.4),
            y: textY,
            size: 10,
            font: this.boldFont,
            color: rgb(0,0,0)
        });

        this.currentPage.drawText(`Frequency: ${frequency}`, {
            x: this.margins.left + (tableWidth * 0.75),
            y: textY,
            size: 10,
            font: this.boldFont,
            color: rgb(0,0,0)
        });

        this.cursorY -= headerHeight;

        // Columns
        const containerTypes = new Set();
        opts.forEach((o) => {
            const ct = o.container_size || o.container_type || "Standard";
            containerTypes.add(ct);
        });
        const sortedContainers = Array.from(containerTypes).sort();

        // Charge Map
        const chargeMap = new Map(); 
        const chargeNoteMap = new Map();

        opts.forEach((o) => {
            const ct = o.container_size || o.container_type || "Standard";
            const charges = o.charges || [];
            charges.forEach((c) => {
                const desc = c.description || c.name || "Charge";
                if (!chargeMap.has(desc)) chargeMap.set(desc, new Map());
                const current = chargeMap.get(desc).get(ct) || 0;
                chargeMap.get(desc).set(ct, current + (Number(c.amount) || 0));
                
                if (c.note) {
                     chargeNoteMap.set(desc, c.note);
                }
            });
        });

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
             this.currentPage.drawText(h, { x: x + 2, y: this.cursorY - 14, size: 9, font: this.boldFont, color: rgb(0,0,0) });
             x += colWidth;
        });
        this.currentPage.drawText("Remarks", { x: x + 2, y: this.cursorY - 14, size: 9, font: this.boldFont, color: rgb(0,0,0) });
        
        this.drawLine(this.margins.left, this.cursorY - rowHeight, this.margins.left + tableWidth, this.cursorY - rowHeight);
        this.cursorY -= rowHeight;

        // Rows
        for (const [desc, amounts] of chargeMap) {
            if (this.cursorY < this.margins.bottom + 20) {
                 this.addNewPage();
                 this.cursorY -= 20;
            }
            
            x = this.margins.left;
            this.currentPage.drawText(desc, { x: x + 2, y: this.cursorY - 14, size: 9, font: this.font, color: rgb(0,0,0) });
            x += firstColWidth;

            sortedContainers.forEach(ct => {
                const val = amounts.get(ct);
                const text = val ? val.toFixed(2) : ""; 
                this.currentPage.drawText(text, { x: x + 2, y: this.cursorY - 14, size: 9, font: this.font, color: rgb(0,0,0) });
                x += colWidth;
            });

            // Remarks
            const note = chargeNoteMap.get(desc) || "";
            if (note) {
                 this.currentPage.drawText(note, { x: x + 2, y: this.cursorY - 14, size: 8, font: this.font, color: rgb(0,0,0) });
            }
            
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
        this.currentPage.drawText("Total", { x: x + 2, y: this.cursorY - 14, size: 9, font: this.boldFont, color: rgb(0,0,0) });
        x += firstColWidth;

        sortedContainers.forEach(ct => {
            const opt = opts.find((o) => (o.container_size || o.container_type || "Standard") === ct);
            const total = opt ? opt.grand_total : 0;
            const text = total.toFixed(2);
            this.currentPage.drawText(text, { x: x + 2, y: this.cursorY - 14, size: 9, font: this.boldFont, color: rgb(0,0,0) });
            x += colWidth;
        });

        this.currentPage.drawText("All Inclusive rates from SD/Port basis", { 
            x: x + 2, 
            y: this.cursorY - 14, 
            size: 8, 
            font: this.font, 
            color: rgb(0,0,0) 
        });

        this.cursorY -= (rowHeight + 20); 
    }
  }

  async save(filename) {
    const pdfBytes = await this.doc.save();
    fs.writeFileSync(filename, pdfBytes);
  }
}

async function run() {
  const renderer = new MockRenderer();
  await renderer.init();
  await renderer.renderDetailedMatrixRateTable();
  await renderer.save('mgl_matrix_test.pdf');
  console.log("PDF generated: mgl_matrix_test.pdf");
}

run();

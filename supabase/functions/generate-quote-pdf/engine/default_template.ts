
import { QuoteTemplate } from "./schema.ts";

export const DefaultTemplate: QuoteTemplate = {
  id: "00000000-0000-0000-0000-000000000000",
  name: "MGL Standard Granular (V2)",
  version: "2.0.0",
  layout_engine: "v2_flex_grid",
  config: {
    page_size: "A4",
    margins: { top: 40, bottom: 40, left: 40, right: 40 },
    font_family: "Helvetica",
    default_locale: "en-US",
    compliance: "None",
  },
  i18n: {
    labels: {
      "quote_number": {
        "en-US": "Quote Reference",
        "es-ES": "Referencia de Cotización",
      },
      "date": {
        "en-US": "Date",
        "es-ES": "Fecha",
      }
    }
  },
  sections: [
    {
      type: "header",
      height: 100,
      page_break_before: false,
      content: {
        text: "MGL Global Logistics",
        alignment: "left",
      }
    },
    {
      type: "static_block",
      height: 30,
      page_break_before: false,
      content: {
        text: "Details (with Equipment/QTY)",
        alignment: "left",
        style: { fontWeight: "bold", fontSize: 12 }
      }
    },
    {
      type: "dynamic_table",
      height: 100,
      page_break_before: false,
      table_config: {
        source: "items",
        columns: [
          { field: "type", label: "Equipment", width: "25%", align: "left" },
          { field: "qty", label: "Qty", width: "15%", align: "center" },
          { field: "commodity", label: "Commodity", width: "30%", align: "left" },
          { field: "details", label: "Weight/Vol", width: "30%", align: "left" }
        ],
        show_subtotals: false
      }
    },
    {
      type: "static_block",
      height: 50,
      page_break_before: false,
      content: {
        text: "Freight Charges Matrix",
        alignment: "left",
        style: { fontWeight: "bold", fontSize: 14 }
      }
    },
    {
      type: "dynamic_table",
      height: 200,
      page_break_before: false,
      table_config: {
        source: "charges",
        columns: [
          { field: "description", label: "Description", width: "50%", align: "left" },
          { field: "currency", label: "Currency", width: "15%", align: "center" },
          { field: "quantity", label: "Qty", width: "15%", align: "center" },
          { field: "amount", label: "Amount", width: "20%", align: "right", format: "currency" }
        ],
        show_subtotals: true
      }
    },
    {
      type: "footer",
      height: 50,
      page_break_before: false,
      content: {
        text: "Thank you for your business!",
        alignment: "center"
      }
    }
  ]
};

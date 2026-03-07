
import { QuoteTemplate } from "./schema.ts";

export const DefaultTemplate: QuoteTemplate = {
  id: "00000000-0000-0000-0000-000000000000",
  name: "MGL Standard Granular (V2)",
  version: "2.1.0",
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
        type: "key_value_grid",
        height: 60,
        config: { columns: 2 },
        grid_fields: [
          { key: "quote.quote_number", label: "Quote Ref" },
          { key: "quote.created_at", label: "Date", format: "date" },
          { key: "quote.expiration_date", label: "Expires", format: "date" },
          { key: "quote.service_level", label: "Service Level" }
        ]
    },
    {
        type: "key_value_grid",
        height: 80,
        config: { columns: 2 },
        grid_fields: [
          { key: "customer.company_name", label: "Customer" },
          { key: "customer.contact_name", label: "Attn" },
          { key: "customer.address", label: "Address" },
          { key: "customer.phone", label: "Phone" },
          { key: "customer.email", label: "Email" },
          { key: "customer.code", label: "Customer Code" },
          { key: "customer.inquiry_number", label: "Inquiry No" }
        ]
    },
    {
      type: "static_block",
      height: 30,
      page_break_before: false,
      content: {
        text: "Cargo Details",
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
          { field: "container_type", label: "Equipment", width: "25%", align: "left" },
          { field: "quantity", label: "Qty", width: "15%", align: "center" },
          { field: "commodity", label: "Commodity", width: "30%", align: "left" },
          { field: "weight", label: "Weight (kg)", width: "15%", align: "right" },
          { field: "volume", label: "Volume (cbm)", width: "15%", align: "right" }
        ],
        show_subtotals: false
      }
    },
    {
      type: "static_block",
      height: 50,
      page_break_before: false,
      content: {
        text: "Freight Charges",
        alignment: "left",
        style: { fontWeight: "bold", fontSize: 14 }
      }
    },
    {
        type: "detailed_matrix_rate_table",
        height: 200,
        config: {
            show_images: true,
            columns: [
                { field: "description", label: "Description", width: "40%" },
                { field: "basis", label: "Basis", width: "15%" },
                { field: "quantity", label: "Qty", width: "10%" },
                { field: "currency", label: "Curr", width: "10%" },
                { field: "rate", label: "Rate", width: "10%" },
                { field: "amount", label: "Amount", width: "15%" }
            ]
        }
    },
    {
      type: "terms_block",
      height: 180,
      page_break_before: false,
      content: {
        text: "Notes and Terms apply as per quote.",
        alignment: "left",
        style: { fontSize: 10 }
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

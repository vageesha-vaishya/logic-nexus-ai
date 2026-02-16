export const AvroPdfGenerated = {
  type: "record",
  name: "PdfGenerated",
  namespace: "logic.nexus.quotation",
  fields: [
    { name: "quote_id", type: "string" },
    { name: "version_id", type: ["null", "string"], default: null },
    { name: "trace_id", type: ["null", "string"], default: null },
    { name: "idempotency_key", type: ["null", "string"], default: null }
  ]
}

export const AvroEmailSent = {
  type: "record",
  name: "EmailSent",
  namespace: "logic.nexus.quotation",
  fields: [
    { name: "quote_id", type: "string" },
    { name: "version_id", type: ["null", "string"], default: null },
    { name: "email_id", type: ["null", "string"], default: null },
    { name: "trace_id", type: ["null", "string"], default: null },
    { name: "idempotency_key", type: ["null", "string"], default: null }
  ]
}

export const AvroQuoteCreated = {
  type: "record",
  name: "QuoteCreated",
  namespace: "logic.nexus.quotation",
  fields: [
    { name: "quote_id", type: "string" },
    { name: "trace_id", type: ["null", "string"], default: null },
    { name: "idempotency_key", type: ["null", "string"], default: null }
  ]
}

export const AvroOptionAdded = {
  type: "record",
  name: "OptionAdded",
  namespace: "logic.nexus.quotation",
  fields: [
    { name: "quote_id", type: "string" },
    { name: "option_id", type: "string" },
    { name: "version_id", type: ["null", "string"], default: null },
    { name: "trace_id", type: ["null", "string"], default: null },
    { name: "idempotency_key", type: ["null", "string"], default: null }
  ]
}

export function schemaForEvent(eventName: string) {
  switch (eventName) {
    case "PdfGenerated": return AvroPdfGenerated
    case "EmailSent": return AvroEmailSent
    case "QuoteCreated": return AvroQuoteCreated
    case "OptionAdded": return AvroOptionAdded
    default: return null
  }
}
